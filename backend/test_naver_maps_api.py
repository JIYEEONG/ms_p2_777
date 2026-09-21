import io
import os
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from fastapi import HTTPException, Response
from pydantic import ValidationError
from backend import naver_maps_api as maps


class MapsTests(unittest.TestCase):
    def test_public_config_does_not_expose_secret(self):
        with patch.dict(os.environ, {'NAVER_MAP_CLIENT_ID': 'public-id', 'NAVER_MAP_CLIENT_SECRET': 'secret-sentinel'}):
            result = maps.maps_config(Response())
        self.assertEqual(result, {'clientId': 'public-id', 'restConfigured': True})
        self.assertNotIn('secret-sentinel', str(result))

    def test_missing_credentials_do_not_make_network_request(self):
        with patch.dict(os.environ, {'NAVER_MAP_CLIENT_ID': '', 'NAVER_MAP_CLIENT_SECRET': ''}), patch.object(maps, 'urlopen') as network:
            with self.assertRaises(HTTPException) as error:
                maps.naver_get('/map-geocode/v2/geocode', {'query': '서울'})
            self.assertEqual(error.exception.status_code, 503)
            network.assert_not_called()

    def test_directions_convert_coordinate_order_and_milliseconds(self):
        body = maps.RouteRequest(start={'lat': 37.5, 'lng': 127}, goal={'lat': 37.6, 'lng': 127.1}, waypoints=[{'lat': 37.55, 'lng': 127.05}])
        upstream = {'code': 0, 'route': {'traoptimal': [{'path': [[127, 37.5], [127.1, 37.6]], 'summary': {'distance': 2500, 'duration': 125000}}]}}
        with patch.object(maps, 'naver_get', return_value=upstream) as request:
            result = maps.directions(body)
        self.assertEqual(request.call_args.args[1], {'start': '127.0,37.5', 'goal': '127.1,37.6', 'option': 'traoptimal', 'waypoints': '127.05,37.55'})
        self.assertEqual(result, {'points': [[37.5, 127], [37.6, 127.1]], 'distanceMeters': 2500, 'durationSeconds': 125})

    def test_reject_invalid_coordinates_and_too_many_stops(self):
        for lat in [91, float('nan')]:
            with self.assertRaises(ValidationError):
                maps.Point(lat=lat, lng=127)
        with self.assertRaises(ValidationError):
            maps.RouteRequest(start={'lat': 37, 'lng': 127}, goal={'lat': 37, 'lng': 127}, waypoints=[{'lat': 37, 'lng': 127}] * 6)

    def test_geocoding_preserves_english_address(self):
        with patch.object(maps, 'naver_get', return_value={'status': 'OK', 'addresses': [{'roadAddress': '서울', 'englishAddress': 'Seoul', 'x': '127', 'y': '37.5'}]}):
            item = maps.geocode('서울')[ 'addresses'][0]
        self.assertEqual(item['englishAddress'], 'Seoul')
        self.assertEqual((item['lat'], item['lng']), (37.5, 127))

    def test_no_route_is_not_reported_as_success(self):
        body = maps.RouteRequest(start={'lat': 37, 'lng': 127}, goal={'lat': 37, 'lng': 127})
        with patch.object(maps, 'naver_get', return_value={'code': 1}):
            with self.assertRaises(HTTPException) as error:
                maps.directions(body)
        self.assertEqual(error.exception.status_code, 422)

    def test_upstream_failure_body_is_not_leaked(self):
        failure = HTTPError('https://maps.apigw.ntruss.com/', 401, 'secret-sentinel', {}, io.BytesIO(b'secret-sentinel'))
        with patch.dict(os.environ, {'NAVER_MAP_CLIENT_ID': 'public-id', 'NAVER_MAP_CLIENT_SECRET': 'secret-sentinel'}), patch.object(maps, 'urlopen', side_effect=failure):
            with self.assertRaises(HTTPException) as error:
                maps.naver_get('/map-geocode/v2/geocode', {'query': '서울'})
        self.assertNotIn('secret-sentinel', str(error.exception.detail))


if __name__ == '__main__':
    unittest.main()
