import requests
import urllib.parse

key = 'sb_publishable_Bih4uz9Nlb_mpaAbY3OqCQ_sIMQ8B4l'

p1 = 'TAT 11761.01 - CHEVROLET TRAILBLAZER 2025 - GMB - SENASP - GF - LOTE +19'
p2 = 'TAT 11761.01G - CHEVROLET TRAILBLAZER - GMB - GF - PRF - LOTE 10'

# Single eq
enc1 = urllib.parse.quote(p1)
url_eq = f'https://oczagzgosnsprogxymtb.supabase.co/rest/v1/fcm_unificado?select=obs_norm&obs_norm=eq.{enc1}&limit=5'
r_eq = requests.get(url_eq, headers={'apikey': key, 'Authorization': f'Bearer {key}'})
print('EQ 1 count:', len(r_eq.json()))

# Multiple in
multi_enc = urllib.parse.quote(f'("{p1}","{p2}")')
url_in = f'https://oczagzgosnsprogxymtb.supabase.co/rest/v1/fcm_unificado?select=obs_norm&obs_norm=in.{multi_enc}&limit=10'
r_in = requests.get(url_in, headers={'apikey': key, 'Authorization': f'Bearer {key}'})
print('IN multi count:', len(r_in.json()))
