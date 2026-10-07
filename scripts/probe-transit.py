import json, os, re, sys, urllib.request
env = {}
for line in open(os.path.join(os.path.dirname(__file__),'..','.env')):
    m = re.match(r'\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?', line)
    if m: env[m[1]] = m[2].strip()
key = env.get('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'); sha = env.get('EXPO_PUBLIC_ANDROID_CERT_SHA1','')
assert key, 'no key'
trips = [
 ("Pimpri Chinchwad (PCMC metro) -> Swargate", (18.6298,73.7997), (18.5018,73.8636)),
 ("Hinjewadi Ph1 -> Shivajinagar", (18.5913,73.7389), (18.5308,73.8475)),
 ("Kothrud (Vanaz) -> Pune Station", (18.5074,73.8077), (18.5286,73.8743)),
 ("Hadapsar -> Deccan Gymkhana", (18.5089,73.9260), (18.5167,73.8411)),
 ("Viman Nagar -> FC Road", (18.5679,73.9143), (18.5236,73.8410)),
]
def call(o,d,mode,extra=None):
    body={"origin":{"location":{"latLng":{"latitude":o[0],"longitude":o[1]}}},
          "destination":{"location":{"latLng":{"latitude":d[0],"longitude":d[1]}}},
          "travelMode":mode,"computeAlternativeRoutes":True,"languageCode":"en-IN","units":"METRIC"}
    if extra: body.update(extra)
    fm = sys.argv[1] if len(sys.argv)>1 else '*'
    req=urllib.request.Request('https://routes.googleapis.com/directions/v2:computeRoutes',data=json.dumps(body).encode(),
        headers={'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':fm,
                 'X-Android-Package':'in.routly.app','X-Android-Cert':sha.replace(':','').upper()})
    try:
        return json.load(urllib.request.urlopen(req,timeout=30))
    except urllib.error.HTTPError as e:
        return {"error":e.read().decode()[:400]}
# Optional overrides: PROBE_DEPARTURE (RFC3339), PROBE_TRIPS (comma-separated name substrings), PROBE_OUT (path).
departure=os.environ.get('PROBE_DEPARTURE','2026-10-08T04:00:00Z')
only=[t.strip() for t in os.environ.get('PROBE_TRIPS','').split(',') if t.strip()]
out={}
for name,o,d in trips:
    if only and not any(t in name for t in only): continue
    out[name]=call(o,d,'TRANSIT',{"departureTime":departure})
json.dump(out,open(os.environ.get('PROBE_OUT') or os.path.join(os.path.dirname(__file__),'transit-probe.json'),'w'))
for name,r in out.items():
    if 'error' in r: print(name,'ERR',r['error']); continue
    print('\n##',name, '| routes:',len(r.get('routes',[])))
    for i,rt in enumerate(r.get('routes',[])):
        segs=[]
        for leg in rt.get('legs',[]):
            for st in leg.get('steps',[]):
                td=st.get('transitDetails')
                if td:
                    l=td.get('transitLine',{}); v=l.get('vehicle',{})
                    segs.append(f"{v.get('type')}:{l.get('nameShort') or l.get('name')}({td.get('stopCount')} stops,{(l.get('agencies') or [{}])[0].get('name')})")
                elif st.get('travelMode')=='WALK':
                    if segs and segs[-1].startswith('WALK'):
                        segs[-1]=f"WALK{int(segs[-1][4:])+st.get('distanceMeters',0)}"
                    else: segs.append(f"WALK{st.get('distanceMeters',0)}")
        fare=rt.get('travelAdvisory',{}).get('transitFare')
        print(f"  [{i}] {int(rt.get('duration','0s')[:-1])//60}min {rt.get('distanceMeters')}m fare={fare} :: "+' > '.join(segs))
