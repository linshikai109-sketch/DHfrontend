/** Synthetic state setup only: invoke existing confirmation command, no bypass or domain changes. */
import {pictureToken} from '../src/domain/profile-picture';
const url='http://127.0.0.1:8933/api/';
const before=await fetch(url+'snapshot').then(r=>r.json());
const request={operationId:'r3-synthetic-workspace-'+Date.now(),role:'john',command:{type:'confirmContext',limited:true,pictureToken:pictureToken(before.workspaces.john)}};
const response=await fetch(url+'commands',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':request.operationId},body:JSON.stringify(request)});
if(!response.ok)throw new Error('Synthetic workspace setup failed: '+response.status);
const after=await response.json();
if(!after.workspaces.john.acquisition.confirmed)throw new Error('Existing confirm command did not complete');
console.log(JSON.stringify({syntheticOnly:true,existingCommand:'confirmContext',johnConfirmed:true,scope:'workspace navigation smoke only, not complete onboarding journey evidence'},null,2));
