import {test} from 'node:test';
import assert from 'node:assert/strict';
import {googleAuthConfig} from '../server/google-auth.js';

test('Google login is enabled only with a complete OAuth configuration',()=>{
 assert.equal(googleAuthConfig({}).enabled,false);
 assert.equal(googleAuthConfig({GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret'}).enabled,false);
 assert.equal(googleAuthConfig({GOOGLE_CLIENT_ID:' id ',GOOGLE_CLIENT_SECRET:' secret ',GOOGLE_CALLBACK_URL:' http://localhost/callback '}).enabled,true);
});
