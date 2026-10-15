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
# shirt: erase old text and reprint
g=cv2.cvtColor(out,cv2.COLOR_BGR2GRAY)
tm=np.zeros((H,W),np.uint8); tm[595:800,225:680]=255
txt=((g<120)&(tm>0)).astype(np.uint8)*255
txt=cv2.dilate(txt,np.ones((7,7),np.uint8))
out=cv2.inpaint(out,txt,9,cv2.INPAINT_TELEA)
img=Image.fromarray(cv2.cvtColor(out,cv2.COLOR_BGR2RGB)); d=ImageDraw.Draw(img)
font=ImageFont.truetype('/System/Library/Fonts/HelveticaNeue.ttc',37,index=1)
lines=["I start three Browns","and I need help","immediately."]
for i,l in enumerate(lines):
    w_=d.textlength(l,font=font); d.text((452-w_/2,612+i*62),l,font=font,fill=(28,28,30))
img.save(sys.argv[3],quality=90)
print('ok')
