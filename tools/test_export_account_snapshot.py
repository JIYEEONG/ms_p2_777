import tempfile
import unittest
from pathlib import Path
from tools.export_account_snapshot import read_moov_storage, snappy, pick, APP_FIELDS


def vint(value):
    output = bytearray()
    while value > 127:
        output.append((value & 127) | 128)
        value >>= 7
    output.append(value)
    return bytes(output)


def string(value):
    return vint(len(value)) + value


def record(data):
    return b'\0' * 4 + len(data).to_bytes(2,'little') + b'\1' + data


class SnapshotExportTests(unittest.TestCase):
    def test_reader_uses_current_logs_filters_origin_and_honors_deletions(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder/'CURRENT').write_text('MANIFEST-000001\n')
            (folder/'MANIFEST-000001').write_bytes(record(vint(2)+vint(5)))
            prefix = b'_http://localhost:3000\0\1'
            name = b'moov-outing-v1:google%3Aone'
            def put(key,value): return b'\1'+string(key)+string(b'\1'+value)
            def batch(sequence,entries): return record(sequence.to_bytes(8,'little')+len(entries).to_bytes(4,'little')+b''.join(entries))
            (folder/'000004.log').write_bytes(batch(999,[put(prefix+name,b'{"old":true}')]))
            (folder/'000005.log').write_bytes(batch(10,[
                put(prefix+name,b'{"savedCourseIds":["one"]}'),
                put(b'_https://elsewhere.invalid\0\1'+name,b'{"private":true}'),
                put(prefix+b'non-moov-key',b'secret'),
                put(prefix+b'moov-app-v3:google%3Aone',b'{"theme":"old"}'),
                b'\0'+string(prefix+b'moov-app-v3:google%3Aone'),
            ]))
            self.assertEqual(read_moov_storage(folder,'http://localhost:3000'),{name.decode():'{"savedCourseIds":["one"]}'})

    def test_snappy_literal_and_overlapping_copy(self):
        self.assertEqual(snappy(vint(6)+bytes([0])+b'a'+bytes([18,1,0])),b'aaaaaa')
        with self.assertRaises(ValueError):
            snappy(vint(6)+bytes([0])+b'a')

    def test_export_allowlist_excludes_auth_messages_payments_and_active_trip(self):
        data={'theme':'기본','tripActive':True,'paymentCards':['private'],'chatThreads':['private'],'userId':'private','session':'private'}
        self.assertEqual(pick(data,APP_FIELDS),{'theme':'기본'})


if __name__ == '__main__':
    unittest.main()
