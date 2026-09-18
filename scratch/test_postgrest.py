import requests
import urllib.parse

key = 'sb_publishable_Bih4uz9Nlb_mpaAbY3OqCQ_sIMQ8B4l'

# Look up what projects exist in fcm_metadata
meta_url = 'https://oczagzgosnsprogxymtb.supabase.co/rest/v1/fcm_metadata?select=projetos_list&id=eq.1'
r_meta = requests.get(meta_url, headers={'apikey': key, 'Authorization': f'Bearer {key}'})
projs = r_meta.json()[0]['projetos_list']
trail = [p for p in projs if '11761.01' in p['nome']]
print('Matching projects in metadata:', [p['nome'] for p in trail[:5]])

if trail:
    p_name = trail[0]['nome']
    print('\nTesting project:', repr(p_name))
    
    # 1. Unencoded
    url_raw = f'https://oczagzgosnsprogxymtb.supabase.co/rest/v1/fcm_unificado?select=obs_norm&obs_norm=in.("{p_name}")'
    res1 = requests.get(url_raw, headers={'apikey': key, 'Authorization': f'Bearer {key}'})
    print('Unencoded result count:', len(res1.json()) if res1.status_code == 200 else res1.text)

    # 2. Encoded
    enc = urllib.parse.quote(f'("{p_name}")')
    url_enc = f'https://oczagzgosnsprogxymtb.supabase.co/rest/v1/fcm_unificado?select=obs_norm&obs_norm=in.{enc}'
    res2 = requests.get(url_enc, headers={'apikey': key, 'Authorization': f'Bearer {key}'})
    print('Encoded result count:', len(res2.json()) if res2.status_code == 200 else res2.text)

    # 3. What if using eq with encoded?
    enc_eq = urllib.parse.quote(p_name)
    url_eq = f'https://oczagzgosnsprogxymtb.supabase.co/rest/v1/fcm_unificado?select=obs_norm&obs_norm=eq.{enc_eq}'
    res3 = requests.get(url_eq, headers={'apikey': key, 'Authorization': f'Bearer {key}'})
    print('EQ encoded result count:', len(res3.json()) if res3.status_code == 200 else res3.text)
