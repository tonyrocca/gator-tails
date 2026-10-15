import cv2, numpy as np, sys
from PIL import Image, ImageDraw, ImageFont
# usage: reece_swap.py <reece selfie (16.jpg)> <monster hat photo (15.jpg)> <out>
src=cv2.imread(sys.argv[1]); dst=cv2.imread(sys.argv[2]); H,W=dst.shape[:2]
# landmark pairs: Reece selfie -> Monster hat guy (eyes, nose, mouth corners, chin, face edge)
S=np.float32([[277.5,450],[400,414],[355,500],[321.5,574],[436,539],[377.5,565],[390,685],
              [232,420],[250,520],[280,630],[465,610],[478,480],[470,400],[340,385]])
D=np.float32([[275,346],[409,306],[375,416],[362,455],[457,436],[410,446],[415,514],
              [240,348],[276,408],[335,484],[470,492],[502,415],[510,330],[342,312]])
# frame points so triangles cover the whole image (global affine from eyes + mouth)
M=cv2.getAffineTransform(S[[0,1,5]],D[[0,1,5]]); Mi=cv2.invertAffineTransform(M)
fr=np.float32([[0,0],[W-1,0],[W-1,H-1],[0,H-1],[W//2,0],[W-1,H//2],[W//2,H-1],[0,H//2]])
Sf=np.vstack([S,(Mi[:,:2]@fr.T).T+Mi[:,2]]); Df=np.vstack([D,fr])
sub=cv2.Subdiv2D((0,0,W,H))
for p in Df: sub.insert((float(min(p[0],W-1)),float(min(p[1],H-1))))
def idx(pt): return int(np.argmin(((Df-pt)**2).sum(1)))
warp=np.zeros_like(dst,np.float32)
for t in sub.getTriangleList():
    pts=t.reshape(3,2)
    if (pts<0).any() or (pts[:,0]>=W).any() or (pts[:,1]>=H).any(): continue
    ii=[idx(p) for p in pts]
    A=cv2.getAffineTransform(Sf[ii].astype(np.float32),Df[ii].astype(np.float32))
    wt=cv2.warpAffine(src,A,(W,H),flags=cv2.INTER_LANCZOS4,borderMode=cv2.BORDER_REFLECT).astype(np.float32)
    tm=np.zeros((H,W),np.uint8); cv2.fillConvexPoly(tm,np.int32(Df[ii]),1)
    warp[tm>0]=wt[tm>0]
# brim shadow on the warped face
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
def brim(x): return 322+(280-322)*(x-275)/(409-275)
dist=yy-brim(xx)
shade=np.clip(0.82+0.18*(dist/60.0),0.82,1.0)[...,None]
warp=np.clip(warp*shade,0,255).astype(np.uint8)
sm=cv2.bilateralFilter(warp,9,40,9); warp=cv2.addWeighted(sm,0.7,warp,0.3,0)
# soften crow's feet and under-eye lines so the grin isn't haggard
sm2=cv2.bilateralFilter(cv2.bilateralFilter(warp,15,60,15),15,60,15)
cf=np.zeros((H,W),np.float32)
for (cx,cy,ax,ay,ang) in [(452,300,30,26,-17),(250,356,22,26,-17),(409,326,34,13,-17),(278,366,30,13,-17)]:
    cv2.ellipse(cf,(cx,cy),(ax,ay),ang,0,360,1,-1)
cf=cv2.GaussianBlur(cf,(0,0),7)[...,None]*0.85
warp=(sm2*cf+warp*(1-cf)).astype(np.uint8)
poly=np.int32([[250,334],[300,318],[410,284],[470,270],[486,300],[490,350],[484,405],[474,450],[468,490],
               [415,518],[345,488],[300,430],[270,392]])
mask=np.zeros((H,W),np.uint8); cv2.fillPoly(mask,[poly],255)
mask[dist<4]=0
mask=cv2.erode(mask,np.ones((5,5),np.uint8))
# Reinhard color transfer (LAB) from destination face to warped Reece, then feathered alpha blend
lab_w=cv2.cvtColor(warp,cv2.COLOR_BGR2LAB).astype(np.float32); lab_d=cv2.cvtColor(dst,cv2.COLOR_BGR2LAB).astype(np.float32)
mm=mask>0
for c in range(3):
    a=lab_w[...,c]; b=lab_d[...,c]
    am,asd,bm,bsd=a[mm].mean(),a[mm].std(),b[mm].mean(),b[mm].std()
    if c==0: tm_,ts=0.55*bm+0.45*am,0.45*bsd+0.55*asd   # brighter, less harsh than the bar lighting
    else:    tm_,ts=0.5*bm+0.5*am,asd                   # keep some of his skin warmth
    a[:]=(a-am)/(asd+1e-6)*ts+tm_
# lift the eye sockets so the eyes read under the brim
em=np.zeros((H,W),np.float32)
for (ex,ey) in [(275,346),(409,306)]: cv2.ellipse(em,(ex,ey),(34,20),-17,0,360,1,-1)
em=cv2.GaussianBlur(em,(0,0),9)
lab_w[...,0]+=14*em
warp2=cv2.cvtColor(np.clip(lab_w,0,255).astype(np.uint8),cv2.COLOR_LAB2BGR)
alpha=cv2.GaussianBlur(mask.astype(np.float32)/255,(0,0),6)[...,None]
out=(warp2*alpha+dst*(1-alpha)).astype(np.uint8)
# shirt: erase old print (text = darker than local fabric), refill, re-add fabric grain
g=cv2.cvtColor(dst,cv2.COLOR_BGR2GRAY).astype(np.float32)
bg=cv2.medianBlur(cv2.cvtColor(dst,cv2.COLOR_BGR2GRAY),31).astype(np.float32)
reg=np.zeros((H,W),bool); reg[590:805,225:690]=True
txt=(((bg-g)>18)&reg).astype(np.uint8)*255
txt=cv2.dilate(txt,np.ones((9,9),np.uint8))
out=cv2.inpaint(out,txt,6,cv2.INPAINT_NS)
# no bright blotches where the old letters were: cap refilled pixels at the surrounding fabric level
ref=cv2.medianBlur(out,41).astype(np.float32); m3=(txt>0)[...,None]
out=np.where(m3,np.minimum(out.astype(np.float32),ref+4),out).astype(np.uint8)
rng=np.random.default_rng(7)
grain=cv2.GaussianBlur(rng.normal(0,3.2,(H,W)).astype(np.float32),(0,0),0.8)
tf=cv2.GaussianBlur(txt.astype(np.float32)/255,(0,0),3)
out=np.clip(out.astype(np.float32)+(grain*tf)[...,None],0,255).astype(np.uint8)
# render new print at 3x, then warp it onto the fabric
K=3; lines=["I start three Browns","and I need help","immediately."]
font=ImageFont.truetype('/System/Library/Fonts/HelveticaNeue.ttc',45*K,index=1)
lay=Image.new('L',(W*K,H*K),0); d=ImageDraw.Draw(lay)
def tracked(y,l,cx,tr):
    w_=sum(d.textlength(ch,font=font) for ch in l)+tr*(len(l)-1); x=cx-w_/2
    for ch in l: d.text((x,y),ch,font=font,fill=255,stroke_width=K,stroke_fill=255); x+=d.textlength(ch,font=font)+tr
for i_,l in enumerate(lines): tracked((604+i_*56)*K,l,452*K,-1.2*K)
tmask=np.asarray(lay.resize((W,H),Image.LANCZOS)).astype(np.float32)/255
# fabric folds: displace by lighting gradient + slight chest curve
L=cv2.GaussianBlur(cv2.cvtColor(out,cv2.COLOR_BGR2GRAY).astype(np.float32),(0,0),7)
gy,gx=np.gradient(L)
yy2,xx2=np.mgrid[0:H,0:W].astype(np.float32)
mx=xx2-gx*0.9; my=yy2-gy*0.9+3.0*((xx2-452)/230.0)**2
tmask=cv2.remap(tmask,mx,my,cv2.INTER_LINEAR)
tmask=cv2.GaussianBlur(tmask,(0,0),0.45)
crack=np.clip(1-0.18*np.abs(cv2.GaussianBlur(rng.normal(0,1,(H,W)).astype(np.float32),(0,0),1.0)),0.75,1)
a=(tmask*0.96*crack)[...,None]
# ink follows the shirt lighting (darker in folds, a touch lighter in highlights) and keeps the weave
o=out.astype(np.float32); low=cv2.GaussianBlur(o,(0,0),5); hp=o-low
ink=low*0.16+hp*0.6+6
out=np.clip(o*(1-a)+ink*a,0,255).astype(np.uint8)
cv2.imwrite(sys.argv[3],out,[cv2.IMWRITE_JPEG_QUALITY,90])
print('ok')
