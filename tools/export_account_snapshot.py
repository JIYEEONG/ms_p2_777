"""Export only MOOV course/preferences keys from an Edge LevelDB, without cookies.

Reads the current manifest, SSTables and write-ahead logs without modifying the
browser profile. --inspect prints course titles and counts, never account IDs.
"""
import argparse
import hashlib
import json
import os
import sqlite3
import struct
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
APP_FIELDS = ('homeMode', 'theme', 'themeConfig', 'rentalHours', 'taxiVehicleType',
              'rentalVehicleType', 'rentalOptions', 'aiPersona', 'aiVoiceEnabled',
              'aiSaveEnabled', 'aiAutoStart', 'chatFontScale', 'productLikes')
OUTING_FIELDS = ('customCourses', 'savedCourseIds', 'likedCourseIds', 'outingSort',
                 'outingFilters', 'recommendationPrefs', 'tasteGroup', 'outingMapOpen')
RENTAL_FIELDS = ('rentalHours', 'rentalVehicleType', 'rentalOptions')
PREFIXES = ('moov-app-v3:', 'moov-outing-v1:', 'moov-home-policy-design-v2:')


def varint(data, pos):
    value = 0
    for shift in range(0, 70, 7):
        byte = data[pos]
        pos += 1
        value |= (byte & 127) << shift
        if byte < 128:
            return value, pos
    raise ValueError('Invalid LevelDB varint')


def string(data, pos):
    size, pos = varint(data, pos)
    if pos + size > len(data):
        raise ValueError('Truncated LevelDB string')
    return data[pos:pos+size], pos+size


def log_records(data):
    parts = []
    for base in range(0, len(data), 32768):
        block = data[base:base+32768]
        pos = 0
        while pos + 7 <= len(block):
            size = int.from_bytes(block[pos+4:pos+6], 'little')
            kind = block[pos+6]
            pos += 7
            if kind == 0:
                break
            if pos + size > len(block):
                break  # An unfinished live write is not a committed record.
            fragment = block[pos:pos+size]
            pos += size
            if kind == 1:
                yield fragment
                parts = []
            elif kind == 2:
                parts = [fragment]
            elif kind == 3 and parts:
                parts.append(fragment)
            elif kind == 4 and parts:
                yield b''.join([*parts, fragment])
                parts = []


def manifest_files(data):
    files, log_number, previous_log = set(), 0, 0
    for record in log_records(data):
        pos = 0
        while pos < len(record):
            tag, pos = varint(record, pos)
            if tag == 1:
                _, pos = string(record, pos)
            elif tag in (2, 3, 4, 9):
                value, pos = varint(record, pos)
                if tag == 2:
                    log_number = value
                elif tag == 9:
                    previous_log = value
            elif tag == 5:
                _, pos = varint(record, pos)
                _, pos = string(record, pos)
            elif tag == 6:
                _, pos = varint(record, pos)
                number, pos = varint(record, pos)
                files.discard(number)
            elif tag == 7:
                _, pos = varint(record, pos)
                number, pos = varint(record, pos)
                _, pos = varint(record, pos)
                _, pos = string(record, pos)
                _, pos = string(record, pos)
                files.add(number)
            else:
                raise ValueError(f'Unsupported LevelDB manifest tag {tag}')
    return files, log_number, previous_log


def snappy(data):
    expected, pos = varint(data, 0)
    if expected > 64 * 1024 * 1024:
        raise ValueError('Unexpectedly large LevelDB block')
    output = bytearray()
    while pos < len(data):
        tag = data[pos]
        pos += 1
        kind = tag & 3
        if kind == 0:
            size = tag >> 2
            if size >= 60:
                extra = size - 59
                size = int.from_bytes(data[pos:pos+extra], 'little')
                pos += extra
            size += 1
            output.extend(data[pos:pos+size])
            pos += size
        else:
            if kind == 1:
                size = 4 + ((tag >> 2) & 7)
                offset = ((tag & 224) << 3) | data[pos]
                pos += 1
            else:
                size = 1 + (tag >> 2)
                extra = 2 if kind == 2 else 4
                offset = int.from_bytes(data[pos:pos+extra], 'little')
                pos += extra
            if offset <= 0 or offset > len(output):
                raise ValueError('Invalid Snappy copy')
            for _ in range(size):
                output.append(output[-offset])
    if len(output) != expected:
        raise ValueError('Incomplete Snappy block')
    return bytes(output)


def block(table, offset, size):
    data = table[offset:offset+size]
    compression = table[offset+size]
    if compression == 0:
        return data
    if compression == 1:
        return snappy(data)
    raise ValueError(f'Unsupported LevelDB compression {compression}')


def block_entries(data):
    restarts = int.from_bytes(data[-4:], 'little')
    end, pos, previous = len(data) - 4 - restarts * 4, 0, b''
    while pos < end:
        shared, pos = varint(data, pos)
        suffix, pos = varint(data, pos)
        size, pos = varint(data, pos)
        if shared > len(previous) or pos + suffix + size > end:
            raise ValueError('Invalid LevelDB entry')
        key = previous[:shared] + data[pos:pos+suffix]
        pos += suffix
        yield key, data[pos:pos+size]
        pos += size
        previous = key


def table_entries(data):
    if len(data) < 48 or data[-8:] != bytes.fromhex('57fb808b247547db'):
        raise ValueError('Unexpected LevelDB table format')
    footer = data[-48:-8]
    _, pos = varint(footer, 0)
    _, pos = varint(footer, pos)
    offset, pos = varint(footer, pos)
    size, _ = varint(footer, pos)
    for _, handle in block_entries(block(data, offset, size)):
        data_offset, pos = varint(handle, 0)
        data_size, _ = varint(handle, pos)
        for key, value in block_entries(block(data, data_offset, data_size)):
            version = int.from_bytes(key[-8:], 'little')
            yield key[:-8], version >> 8, version & 255, value


def batch_entries(data):
    if len(data) < 12:
        return
    sequence, count = struct.unpack_from('<QI', data)
    pos = 12
    for index in range(count):
        kind = data[pos]
        pos += 1
        key, pos = string(data, pos)
        value = b''
        if kind == 1:
            value, pos = string(data, pos)
        elif kind != 0:
            raise ValueError('Unsupported LevelDB write batch')
        yield key, sequence + index, kind, value


def dom_string(data):
    if not data:
        return ''
    if data[0] == 0:
        return data[1:].decode('utf-16-le')
    if data[0] == 1:
        return data[1:].decode('latin-1')
    raise ValueError('Unknown Chromium DOM storage encoding')


def read_moov_storage(directory, origin):
    current = (directory / 'CURRENT').read_text().strip()
    if Path(current).name != current or not current.startswith('MANIFEST-'):
        raise ValueError('Invalid LevelDB manifest name')
    manifest = (directory / current).read_bytes()
    files, log_number, previous_log = manifest_files(manifest)
    latest = {}
    prefix = b'_' + origin.encode() + b'\0'

    def accept(entries):
        for key, sequence, kind, value in entries:
            if not key.startswith(prefix):
                continue
            name = dom_string(key[len(prefix):])
            if not name.startswith(PREFIXES) and name != 'moov-language':
                continue
            if name not in latest or latest[name][0] < sequence:
                latest[name] = (sequence, kind, value)

    for number in sorted(files):
        table = directory / f'{number:06d}.ldb'
        if not table.exists():
            table = directory / f'{number:06d}.sst'
        accept(table_entries(table.read_bytes()))
    for log in directory.glob('*.log'):
        if int(log.stem) >= log_number or int(log.stem) == previous_log:
            for batch in log_records(log.read_bytes()):
                accept(batch_entries(batch))
    if (directory / 'CURRENT').read_text().strip() != current or (directory / current).read_bytes() != manifest:
        raise RuntimeError('Browser storage changed during export; retry the command')
    return {name: dom_string(value) for name, (_, kind, value) in latest.items() if kind == 1}


def scoped_accounts(storage):
    accounts = {}
    for key, value in storage.items():
        for prefix in PREFIXES:
            if key.startswith(prefix):
                owner = unquote(key[len(prefix):])
                if owner.startswith('google:'):
                    accounts.setdefault(owner, {})[prefix] = json.loads(value)
    return accounts


def pick(data, fields):
    return {key: data[key] for key in fields if key in data}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inspect', action='store_true')
    parser.add_argument('--owner-hash', help='Account hash prefix printed by --inspect')
    parser.add_argument('--origin', default='http://localhost:3000')
    args = parser.parse_args()
    directory = Path(os.environ['LOCALAPPDATA']) / 'Microsoft/Edge/User Data/Default/Local Storage/leveldb'
    storage = read_moov_storage(directory, args.origin)
    accounts = scoped_accounts(storage)
    if args.inspect:
        for owner, data in accounts.items():
            outing = data.get('moov-outing-v1:', {})
            print(json.dumps({'accountHash': hashlib.sha256(owner.encode()).hexdigest(),
                              'courses': [c.get('name') for c in outing.get('customCourses', [])],
                              'savedCourses': len(outing.get('savedCourseIds', [])),
                              'appSettings': list(pick(data.get('moov-app-v3:', {}), APP_FIELDS)),
                              'rentalSettings': list(pick(data.get('moov-home-policy-design-v2:', {}), RENTAL_FIELDS))}, ensure_ascii=False))
        return
    matches = [(owner, data) for owner, data in accounts.items()
               if args.owner_hash and hashlib.sha256(owner.encode()).hexdigest().startswith(args.owner_hash)]
    if len(matches) != 1:
        raise ValueError('Select exactly one account hash from --inspect')
    owner, data = matches[0]
    owner_hash = hashlib.sha256(owner.encode()).hexdigest()
    snapshot = {'schemaVersion': 1, 'accountHash': owner_hash, 'exportedAt': datetime.now(timezone.utc).isoformat(),
                'language': 'en' if storage.get('moov-language') == 'en' else 'ko',
                'appSettings': pick(data.get('moov-app-v3:', {}), APP_FIELDS),
                'outing': pick(data.get('moov-outing-v1:', {}), OUTING_FIELDS),
                'rentalSettings': pick(data.get('moov-home-policy-design-v2:', {}), RENTAL_FIELDS)}
    db = ROOT / 'backend/.user-surveys.sqlite3'
    if db.exists():
        conn = sqlite3.connect(db.as_uri() + '?mode=ro', uri=True)
        try:
            row = conn.execute('SELECT version,status,answers_json FROM user_survey WHERE user_id=?', (owner,)).fetchone()
            if row:
                snapshot['survey'] = {'version': row[0], 'status': row[1], 'answers': json.loads(row[2])}
        finally:
            conn.close()
    target = ROOT / 'backend/account_snapshots' / f'{owner_hash}.json'
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'file': str(target.relative_to(ROOT)), 'courses':len(snapshot['outing'].get('customCourses', [])),
                      'surveyIncluded':'survey' in snapshot}, ensure_ascii=False))


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    main()
