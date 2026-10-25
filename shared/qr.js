// QR Code Model 2, version 2, error correction L, byte mode, mask 0.
// Labels carry a short internal item ID; the printed SKU remains human-readable.
export function qrMatrix(text){
 const bytes=new TextEncoder().encode(text);if(bytes.length>32)throw Error('Mã nhãn quá dài');
 const bits=[];const append=(n,len)=>{for(let i=len-1;i>=0;i--)bits.push((n>>>i)&1)};
 append(4,4);append(bytes.length,8);for(const b of bytes)append(b,8);
 append(0,Math.min(4,272-bits.length));while(bits.length%8)bits.push(0);
 const data=[];for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((a,b)=>a*2+b,0));while(data.length<34)data.push(data.length%2===Math.ceil(bits.length/8)%2?236:17);
 const mul=(a,b)=>{let r=0;for(let i=7;i>=0;i--){r=(r<<1)^((r>>>7)*0x11d);r^=((b>>>i)&1)*a}return r};
 const divisor=Array(10).fill(0);divisor[9]=1;let root=1;
 for(let i=0;i<10;i++){for(let j=0;j<10;j++)divisor[j]=mul(divisor[j],root)^(j<9?divisor[j+1]:0);root=mul(root,2)}
 const ecc=Array(10).fill(0);for(const b of data){const factor=b^ecc.shift();ecc.push(0);for(let j=0;j<10;j++)ecc[j]^=mul(divisor[j],factor)}
 const n=25,m=Array.from({length:n},()=>Array(n).fill(false)),f=Array.from({length:n},()=>Array(n).fill(false));
 const set=(x,y,v)=>{if(x>=0&&y>=0&&x<n&&y<n){m[y][x]=!!v;f[y][x]=true}};
 for(let i=0;i<n;i++){set(6,i,i%2===0);set(i,6,i%2===0)}
 for(const [cx,cy]of [[3,3],[n-4,3],[3,n-4]])for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,d!==2&&d!==4)}
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(18+dx,18+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
 const value=8;let rem=value;for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);const fmt=((value<<10)|rem)^0x5412;
 for(let i=0;i<=5;i++)set(8,i,(fmt>>>i)&1);set(8,7,(fmt>>>6)&1);set(8,8,(fmt>>>7)&1);set(7,8,(fmt>>>8)&1);
 for(let i=9;i<15;i++)set(14-i,8,(fmt>>>i)&1);
 for(let i=0;i<8;i++)set(n-1-i,8,(fmt>>>i)&1);for(let i=8;i<15;i++)set(8,n-15+i,(fmt>>>i)&1);set(8,n-8,true);
 const stream=[...data,...ecc].flatMap(b=>Array.from({length:8},(_,i)=>(b>>>(7-i))&1));let k=0;
 for(let right=n-1;right>=1;right-=2){if(right===6)right=5;for(let v=0;v<n;v++){const y=((right+1)&2)===0?n-1-v:v;for(let j=0;j<2;j++){const x=right-j;if(!f[y][x])m[y][x]=!!((stream[k++]||0)^((x+y)%2===0?1:0))}}}
 return m;
}
