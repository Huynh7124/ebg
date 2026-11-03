import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import bcrypt from 'bcryptjs';
import {googleAuthConfig,registerGoogleAuth} from '../server/google-auth.js';
import {registerPeople} from '../server/roles.js';

test('Google login is enabled only with a complete OAuth configuration',()=>{
 assert.equal(googleAuthConfig({}).enabled,false);
 assert.equal(googleAuthConfig({GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret'}).enabled,false);
 assert.equal(googleAuthConfig({GOOGLE_CLIENT_ID:' id ',GOOGLE_CLIENT_SECRET:' secret ',GOOGLE_CALLBACK_URL:' http://localhost/callback '}).enabled,true);
});

test('unknown verified Google Gmail waits for approval, then receives the selected role',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,username TEXT UNIQUE,password TEXT,role TEXT,email TEXT UNIQUE COLLATE NOCASE,locked INTEGER DEFAULT 0);CREATE TABLE google_access_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE COLLATE NOCASE,requestedAt TEXT NOT NULL);CREATE TABLE audit(id INTEGER PRIMARY KEY,user TEXT,action TEXT,date TEXT);CREATE TABLE sessions(sid TEXT PRIMARY KEY,data TEXT,expires INTEGER);CREATE TABLE password_reset_requests(userId INTEGER PRIMARY KEY,requestedAt TEXT NOT NULL)');
 const getRoutes={},postRoutes={},app={get(path,handler){getRoutes[path]=handler},post(path,...handlers){postRoutes[path]=handlers.at(-1)}};
 const config={enabled:true,clientId:'id',clientSecret:'secret',callbackUrl:'http://localhost/callback'},fetcher=async url=>url.includes('token')?{ok:true,json:async()=>({access_token:'token'})}:{ok:true,json:async()=>({email:'new.staff@example.com',email_verified:true,name:'Nhân viên mới'})};
 registerGoogleAuth(app,db,{config,fetcher,normalizeEmail:value=>value.trim().toLowerCase()});
 let redirect='';await getRoutes['/api/auth/google/callback']({session:{googleOAuthState:'state'},query:{state:'state',code:'code'}},{redirect:value=>redirect=value});
 assert.match(decodeURIComponent(redirect),/Yêu cầu đã được gửi/);const pending=db.prepare('SELECT * FROM google_access_requests').get();assert.equal(pending.email,'new.staff@example.com');
 db.prepare('INSERT INTO users(name,username,email,password,role) VALUES(?,?,?,?,?)').run('Admin','admin','admin@example.com',bcrypt.hashSync('password-password',10),'admin');
 registerPeople(app,db,(req,action)=>db.prepare('INSERT INTO audit(user,action,date) VALUES(?,?,?)').run(req.session.user.name,action,new Date().toISOString()),bcrypt,value=>value.trim().toLowerCase(),value=>value.includes('@'),{passwordRequired:false});
 let response;const res={status(code){this.code=code;return this},json(value){response=value}};postRoutes['/api/google-access-requests/:id/approve']({params:{id:String(pending.id)},body:{role:'packer'},session:{user:{id:1,name:'Admin',role:'admin'}}},res);
 assert.deepEqual(response,{ok:true});assert.equal(db.prepare('SELECT role FROM users WHERE email=?').get(pending.email).role,'packer');assert.equal(db.prepare('SELECT COUNT(*) n FROM google_access_requests').get().n,0);db.close();
});
