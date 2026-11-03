import {randomBytes} from 'node:crypto';

const authUrl='https://accounts.google.com/o/oauth2/v2/auth';
const tokenUrl='https://oauth2.googleapis.com/token';
const userInfoUrl='https://openidconnect.googleapis.com/v1/userinfo';

export function googleAuthConfig(env=process.env){
 const clientId=String(env.GOOGLE_CLIENT_ID||'').trim(),clientSecret=String(env.GOOGLE_CLIENT_SECRET||'').trim(),callbackUrl=String(env.GOOGLE_CALLBACK_URL||'').trim();
 return {enabled:Boolean(clientId&&clientSecret&&callbackUrl),clientId,clientSecret,callbackUrl};
}

export function registerGoogleAuth(app,db,{publicUser,normalizeEmail,config=googleAuthConfig(),fetcher=fetch}={}){
 if(!config.enabled)return;
 const fail=(res,message)=>res.redirect('/?auth_error='+encodeURIComponent(message));
 app.get('/api/auth/google',(req,res)=>{
  const state=randomBytes(24).toString('base64url');req.session.googleOAuthState=state;
  const query=new URLSearchParams({client_id:config.clientId,redirect_uri:config.callbackUrl,response_type:'code',scope:'openid email profile',state,prompt:'select_account'});
  res.redirect(authUrl+'?'+query);
 });
 app.get('/api/auth/google/callback',async(req,res)=>{
  const expected=req.session.googleOAuthState;delete req.session.googleOAuthState;
  if(!expected||typeof req.query.state!=='string'||req.query.state!==expected)return fail(res,'Phiên đăng nhập Google không hợp lệ. Vui lòng thử lại.');
  if(typeof req.query.code!=='string'||!req.query.code)return fail(res,'Google không trả về mã đăng nhập.');
  try{
   const tokenResponse=await fetcher(tokenUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:req.query.code,client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:config.callbackUrl,grant_type:'authorization_code'})});
   const token=await tokenResponse.json();if(!tokenResponse.ok||!token.access_token)throw Error('token');
   const profileResponse=await fetcher(userInfoUrl,{headers:{authorization:'Bearer '+token.access_token}}),profile=await profileResponse.json();
   const email=normalizeEmail(profile.email);if(!profileResponse.ok||!email||profile.email_verified!==true)return fail(res,'Gmail chưa được Google xác minh.');
   const user=db.prepare('SELECT id,name,role,locked FROM users WHERE email=? COLLATE NOCASE').get(email);
   if(!user){db.prepare("INSERT INTO google_access_requests(name,email,requestedAt) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,requestedAt=excluded.requestedAt").run(String(profile.name||email).trim().slice(0,100)||email,email,new Date().toISOString());return fail(res,'Gmail này chưa được cấp quyền. Yêu cầu đã được gửi để Admin hoặc nhân viên kho duyệt.');}
   if(user.locked)return fail(res,'Tài khoản này đang bị khóa. Vui lòng liên hệ Admin hoặc nhân viên kho.');
   req.session.regenerate(error=>{if(error)return fail(res,'Không thể tạo phiên đăng nhập.');req.session.user={id:user.id,name:user.name,role:user.role};req.session.csrf=randomBytes(24).toString('hex');res.redirect('/')});
  }catch{return fail(res,'Không thể xác minh tài khoản Google. Vui lòng thử lại.')}
 });
}
