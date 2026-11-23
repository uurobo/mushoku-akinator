#!/usr/bin/env python3
"""使い方: python tools/check.py            データの検査
          python tools/check.py --compact  characters.json を簡易形式(has/unknown)に変換して characters.compact.json を出力"""
import json, sys, itertools
E=json.load(open('elements.json',encoding='utf-8'))['categories']
els={x['id']:x for c in E for x in c['elements']}
C=json.load(open('characters.json',encoding='utf-8'))['characters']

def anc(i,out=None):
    out=out if out is not None else set()
    for p in els[i].get('parents',[]):
        if p not in out: out.add(p); anc(p,out)
    return out
def vec(ch):
    if 'elements' in ch:
        m={k:(None if v.get('confidence',1)==0 or v['value']<0 else v['value']) for k,v in ch['elements'].items()}
        for k in els: m.setdefault(k,None)
    else:
        m={k:0 for k in els}
        for k in ch.get('unknown',[]): m[k]=None
        for k in ch.get('has',[]): m[k]=1
    for k in [k for k,v in m.items() if v==1]:
        for p in anc(k): m[p]=1
    return m

if '--compact' in sys.argv:
    out=[]
    for ch in C:
        m=vec(ch)
        out.append({"id":ch['id'],"name":ch['name'],"aliases":ch.get('aliases',[]),
          "has":[k for k,v in m.items() if v==1 and not any(k in anc(h) for h,hv in m.items() if hv==1 and h!=k and k in anc(h))],
          "unknown":[k for k,v in m.items() if v is None]})
    json.dump({"characters":out},open('characters.compact.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
    print('characters.compact.json を出力しました'); sys.exit()

warn=0
def w(s):
    global warn; warn+=1; print('⚠',s)
for i,x in els.items():
    for p in x.get('parents',[]):
        if p not in els: w(f'要素 {i}: 親 {p} が存在しません')
ids=[c['id'] for c in C]
for d in {i for i in ids if ids.count(i)>1}: w(f'キャラID重複: {d}')
V={c['id']:vec(c) for c in C}
for c in C:
    for k in list(c.get('elements',{}))+c.get('has',[])+c.get('unknown',[]):
        if k not in els: w(f'{c["id"]}: 未定義の要素 {k}')
for k in els:
    vs={V[c][k] for c in V if V[c][k] is not None}
    if len(vs)<=1: w(f'要素 {k}({els[k]["name"]}): 全員同じ値で質問として機能しません')
for a,b in itertools.combinations(C,2):
    if all(V[a['id']][k]==V[b['id']][k] for k in els): w(f'{a["name"]} と {b["name"]} は全要素が同じで区別できません')
for k,x in els.items():
    if 'question' not in x: pass
print(f'キャラ {len(C)} / 要素 {len(els)} / 警告 {warn}')
