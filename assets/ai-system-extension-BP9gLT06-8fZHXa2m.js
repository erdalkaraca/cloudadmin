import{A as e,F as t,H as n,M as r,N as i,O as a,P as o,T as s,U as c,V as l,W as u,_ as d,a as f,c as p,d as m,g as h,k as g,m as ee,n as te,nt as _,o as ne,ot as v,rt as re,st as y,w as ie}from"./dist-DFIIeeW2.js";import{_ as ae,c as oe,d as b,g as x,l as se,m as ce,p as le,u as S}from"./fs-access-D-fDaJ8V-D4qvKoNj.js";var ue=`events/aiservice/streamStarted`,de=`events/aiservice/streamChunk`,fe=`events/aiservice/streamComplete`,pe=`events/aiservice/streamError`,me=`events/aiservice/aiConfigChanged`,he=`events/aiservice/agentWorkflowStarted`,ge=`events/aiservice/agentWorkflowComplete`,_e=`events/aiservice/agentWorkflowError`,ve=`aiservice.agents`,C=`aiservice.chatProviders`,ye=`aiservice.promptEnhancers`,w=`aiConfig`,be={defaultProvider:`openai`,providers:[],requireToolApproval:!0},xe=class{constructor(){this.decoder=new TextDecoder,this.usage=null}async*readLines(e){let t=``;this.usage=null;try{for(;;){let{done:n,value:r}=await e.read();if(n)break;t+=this.decoder.decode(r,{stream:!0});let i=t.split(`
`);t=i.pop()||``;for(let e of i)e.trim()&&(yield*this.processLine(e))}t.trim()&&(yield*this.processLine(t)),yield this.makeDoneChunk()}finally{e.releaseLock()}}makeDoneChunk(){let e={type:`done`,content:``};return this.usage&&(e.metadata={usage:this.usage}),e}},Se=class extends xe{async*parse(e){yield*this.readLines(e)}async*processLine(e){if(!e.startsWith(`data: `))return;let t=e.slice(6).trim();if(t===`[DONE]`){yield this.makeDoneChunk();return}try{let e=JSON.parse(t);if(e.error){yield{type:`error`,content:e.error.message||`Unknown error`,metadata:e.error};return}this.extractUsage(e);let n=this.parseChunk(e);n&&(yield n)}catch{}}extractUsage(e){if(!e.usage)return;let t=e.usage;this.usage={promptTokens:t.prompt_tokens||0,completionTokens:t.completion_tokens||0,totalTokens:t.total_tokens||0,estimated:!1}}parseChunk(e){let t=e.choices?.[0]?.delta,n=e.choices?.[0];if(t?.content)return{type:`token`,content:t.content,message:{role:t.role||`assistant`,content:n?.message?.content||t.content}};if(n?.message?.tool_calls){let e=this.parseToolCalls(n.message.tool_calls,!0);if(e.length>0)return{type:`token`,content:``,toolCalls:e}}else if(t?.tool_calls||n?.delta?.tool_calls){let e=this.parseToolCalls(t?.tool_calls||n?.delta?.tool_calls||[],!1);if(e.length>0)return{type:`token`,content:``,toolCalls:e}}return null}parseToolCalls(e,t){return e.filter(e=>e.function!==void 0).map((e,n)=>({id:e.id||`call_${e.index===void 0?n:e.index}_${Date.now()}`,type:`function`,function:{name:e.function?.name||``,arguments:e.function?.arguments||(t?`{}`:``)},_index:e.index===void 0?n:e.index}))}},Ce=class extends xe{async*parse(e){yield*this.readLines(e)}async*processLine(e){try{let t=JSON.parse(e);if(t.error){yield{type:`error`,content:t.error,metadata:t};return}if(t.done){this.extractUsage(t),yield this.makeDoneChunk();return}let n=this.parseToken(t);n&&(yield n)}catch{}}extractUsage(e){if(e.prompt_eval_count===void 0&&e.eval_count===void 0)return;let t=e.prompt_eval_count||0,n=e.eval_count||0;this.usage={promptTokens:t,completionTokens:n,totalTokens:t+n,estimated:!1}}parseToken(e){return e.message?.content?{type:`token`,content:e.message.content,message:{role:e.message.role||`assistant`,content:e.message.content}}:e.response?{type:`token`,content:e.response,message:{role:`assistant`,content:e.response}}:null}};async function we(e,t,n){let r=``,i=n.getProvider(t);for await(let n of i.stream({model:t.model,messages:e,chatConfig:t}))n.type===`token`&&(r+=n.content);return r}function Te(e){if(!e)return null;if(e.includes(`/v1/chat/completions`))return e.replace(`/v1/chat/completions`,``);if(e.includes(`/api/v1/chat/completions`))return e.replace(`/api/v1/chat/completions`,``);if(e.includes(`/api/chat/completion`))return e.replace(`/api/chat/completion`,``);try{let t=new URL(e);return`${t.protocol}//${t.host}`}catch{return null}}var Ee=class{createParser(e,t){return e.includes(`text/event-stream`)||t.includes(`openai`)?new Se:new Ce}async getAvailableModels(e){if(!e.chatApiEndpoint)return[];let t=Te(e.chatApiEndpoint);if(!t)return[];try{let n={"Content-Type":`application/json`};e.apiKey&&(n.Authorization=`Bearer ${e.apiKey}`);let r=await fetch(`${t}/v1/models`,{method:`GET`,headers:n});return r.ok?((await r.json()).data||[]).map(e=>({id:e.id,name:e.name||e.id})):[]}catch{return[]}}async*stream(e){let t={model:e.model,stream:!0,messages:e.messages,...e.chatConfig.parameters};e.tools&&e.tools.length>0&&(t.tools=e.tools,t.tool_choice=`auto`);let n=await fetch(e.chatConfig.chatApiEndpoint,{method:`POST`,headers:{Authorization:`Bearer ${e.chatConfig.apiKey}`,"Content-Type":`application/json`,Accept:`text/event-stream`},body:JSON.stringify(t),signal:e.signal});if(!n.ok){let e=await n.text().catch(()=>`Unknown error`);yield{type:`error`,content:`HTTP ${n.status}: ${e}`,metadata:{status:n.status}};return}if(!n.body){yield{type:`error`,content:`Response body is null or empty`,metadata:{status:n.status}};return}let r=n.body.getReader();if(!r){yield{type:`error`,content:`Response body is not readable`};return}let i=n.headers.get(`content-type`)||``,a=this.createParser(i,e.chatConfig.chatApiEndpoint);try{for await(let e of a.parse(r))yield e}catch(e){yield{type:`error`,content:e instanceof Error?e.message:`Failed to parse response stream`,metadata:{error:e,contentType:i}}}}},De=class extends Ee{constructor(...e){super(...e),this.name=`openai`}canHandle(e){return e.chatApiEndpoint.includes(`openai`)||e.chatApiEndpoint.includes(`v1/chat/completions`)}},Oe=class extends Ee{constructor(...e){super(...e),this.name=`ollama`}canHandle(e){return e.name.toLowerCase()===`ollama`||e.chatApiEndpoint.includes(`ollama`)||e.chatApiEndpoint.includes(`localhost:11434`)}},T=class{constructor(){this.providers=[],this.providers.push(new De),this.providers.push(new Oe)}registerProvider(e){this.providers.push(e)}getProvider(e){return this.providers.find(t=>t.canHandle(e))??this.providers[0]}getAllProviders(){return[...this.providers]}},ke=class{getAgentContributions(){return n.getContributions(ve)}filterAndSortAgents(e,t){return e.filter(e=>!e.canHandle||e.canHandle(t)).sort((e,t)=>(t.priority||0)-(e.priority||0))}getMatchingAgents(e,t){let n=this.getAgentContributions();if(n.length===0)throw Error(`No agents are registered. The App Support agent should be available from the AI system extension.`);let r=t?.length?n.filter(e=>t.includes(e.role)):n,i=this.filterAndSortAgents(r,e);if(t?.length&&i.length===0)throw Error(`No agents found for requested roles: ${t.join(`, `)}. Available: ${n.map(e=>e.role).join(`, `)}`);if(!t?.length&&i.length===0)throw Error(`No agents can handle the current context. Available: ${n.map(e=>e.role).join(`, `)}`);return i}};function Ae(e){let t={role:e.role,content:e.content};return`tool_call_id`in e&&e.tool_call_id&&(t.tool_call_id=e.tool_call_id),`tool_calls`in e&&e.tool_calls&&(t.tool_calls=e.tool_calls),t}function je(e){return e.map(Ae)}var Me=le(`ToolDetector`),Ne=[`hello`,`hi`,`hey`,`thanks`,`thank you`,`bye`,`goodbye`],Pe=`create.open.delete.read.write.edit.save.rename.move.copy.list.show.display.run.execute.build.add.remove.update.modify.change.set.get.find.search.filter.sort.install.uninstall.load.import.export.generate.make.do.perform.call.invoke`.split(`.`),Fe=[`file`,`folder`,`directory`,`workspace`,`editor`,`map`,`layer`,`command`,`tool`,`extension`,`script`,`code`,`project`],Ie=new class{needsTools(e){if(!e?.trim())return!1;let t=e.toLowerCase().trim();if(Ne.some(e=>t===e||t.startsWith(e+` `)))return!1;let n=Pe.some(t=>e.includes(t)),r=Fe.some(t=>e.includes(t)),i=n&&(r||e.length>20);return i&&Me.info(`Heuristic: needsTools=true (action+context or long prompt)`),i}dispose(){}},Le=le(`PromptBuilder`),Re=class{constructor(e){this.toolRegistry=e,this.enhancers=[]}addEnhancer(e){this.enhancers.push(e)}async getSysPrompt(e,t){let n=e.sysPrompt;if(typeof n==`function`&&(n=n()),!n||typeof n!=`string`)throw Error(`Agent "${e.role}" is missing a system prompt.`);let r=[...e.promptEnhancers||[],...this.enhancers,...this.getContributedEnhancers()].sort((e,t)=>(t.priority||0)-(e.priority||0)),i=n;for(let e of r)try{let n=await e.enhance(i,t);n&&typeof n==`string`&&(i=n)}catch(e){Le.warn(`Enhancer failed:`,e)}return i}rewriteChatHistoryForAgent(e,t){return e.map(e=>e.role===`user`?{role:e.role,content:e.content}:e.role===t?{role:`assistant`,content:e.content}:{role:`user`,content:`***Agent '${e.role}' replied:***\n${e.content}`})}getContributedEnhancers(){return n.getContributions(ye).map(e=>({...e.enhancer,priority:e.priority??e.enhancer.priority}))}async build(e,t,n,r){r?.beforeSend&&await r.beforeSend(t,n);let i=je(t),a=this.rewriteChatHistoryForAgent(i,e.role),o=e.tools;typeof o==`function`&&(o=await o());let s;if(o?.enabled)if(o.smartToolDetection){let e=t[t.length-1];Ie.needsTools(e?.content||``)&&(s=this.toolRegistry.getAvailableTools(n,o.commandFilter))}else s=this.toolRegistry.getAvailableTools(n,o.commandFilter);let c=await this.getSysPrompt(e,n);return a.unshift({role:`system`,content:c}),{messages:a,userPromptIndex:a.length-1,tools:s}}},ze=class{constructor(){this.processors=[]}addProcessor(e){this.processors.push(e)}async process(e,t,n){let r=[...t.messageProcessors||[],...this.processors].sort((e,t)=>(t.priority||0)-(e.priority||0)),i={...e};for(let e of r)i=await e.process(i,n);return i}},Be=class{constructor(){this.accumulatedToolCalls=new Map,this.toolCallIndexMap=new Map}processChunk(e){if(!(e.type!==`token`||!e.toolCalls?.length))for(let t of e.toolCalls){let e=t._index,n=t.id,r,i;e!==void 0&&this.toolCallIndexMap.has(e)?(i=this.toolCallIndexMap.get(e),r=this.accumulatedToolCalls.get(i)):n&&this.accumulatedToolCalls.has(n)?(i=n,r=this.accumulatedToolCalls.get(i)):(i=n||`call_${e===void 0?Date.now():e}_${Math.random()}`,r=void 0),r?(this.accumulatedToolCalls.set(i,{id:i,type:t.type||r.type,function:{name:t.function.name||r.function.name,arguments:(r.function.arguments||``)+(t.function.arguments||``)}}),e!==void 0&&!this.toolCallIndexMap.has(e)&&this.toolCallIndexMap.set(e,i)):(this.accumulatedToolCalls.set(i,{...t,id:i}),e!==void 0&&this.toolCallIndexMap.set(e,i))}}getFinalToolCalls(){return Array.from(this.accumulatedToolCalls.values()).filter(e=>e.function.name?.trim().length>0).map(e=>({...e,function:{...e.function,arguments:e.function.arguments?.trim()||`{}`}}))}reset(){this.accumulatedToolCalls.clear(),this.toolCallIndexMap.clear()}};function E(e){return e.replace(/[^a-zA-Z0-9_-]/g,`_`).replace(/^[^a-zA-Z]/,`cmd_$&`).replace(/_+/g,`_`).replace(/^_|_$/g,``)}var Ve=class{findCommand(e,t){let n=e.function.name,r=l.getCommand(n);if(r)return r;let i=l.listCommands();for(let[e,t]of Object.entries(i))if(E(e)===n)return t;return null}parseArguments(e){if(!e?.trim()||e===`{}`)return{};try{let t=JSON.parse(e);return t&&typeof t==`object`?t:{}}catch{return{}}}sanitizeArguments(e,t){if(!t?.parameters||!e||typeof e!=`object`)return e||{};let n={};return t.parameters.forEach(t=>{let r=E(t.name);r in e&&(n[t.name]=e[r])}),n}async executeToolCall(e,t){try{let n=this.findCommand(e,t),r=n?.id||e.function.name,i=this.parseArguments(e.function.arguments||`{}`),a=this.sanitizeArguments(i,n),o=l.createExecutionContext(a),s={...t,...o,params:a},c=await l.execute(r,s),u={success:!0,message:`Command "${n?.name||r}" executed successfully`,command:r};if(Object.keys(a).length>0&&(u.parameters=a),c!=null){let e=c;e instanceof Promise&&(e=await e),u.result=e,n?.output?.length&&(u.output=n.output.map(e=>`${e.name}: ${e.description||e.type||`value`}`).join(`, `))}return{id:e.id,result:u}}catch(n){let r=null;try{r=this.findCommand(e,t)}catch{}let i=n instanceof Error?n.message:String(n),a=r?.name||e.function.name,o=i;return(i.includes(`No handler found`)||i.includes(`No handlers registered`))&&(o=`Command "${a}" cannot be executed. ${i}.`),{id:e.id,result:null,error:o}}}async executeToolCalls(e,t){let n=[];for(let r of e)n.push(await this.executeToolCall(r,t));return n}createToolCallAccumulator(){return new Be}createToolCallSignature(e){let t={};try{let n=JSON.parse(e.function.arguments||`{}`);t=n&&typeof n==`object`?n:{}}catch{t={}}let n=Object.keys(t).sort().reduce((e,n)=>(e[n]=t[n],e),{});return`${e.function.name}:${JSON.stringify(n)}`}},He=class{commandToTool(e,t){let n={},r=[];return e.parameters?.forEach(e=>{let t=E(e.name);n[t]={type:e.type||`string`,description:e.description,...e.allowedValues&&{enum:e.allowedValues}},e.required===!0&&r.push(t)}),{type:`function`,function:{name:E(e.id),description:e.description||e.name,parameters:{type:`object`,properties:n,required:r}}}}getAvailableTools(e,t){let n=l.listCommands(),r=Object.values(n);return t&&(r=r.filter(n=>t(n,e))),r.map(t=>this.commandToTool(t,e))}},Ue=class{async execute(e,t,n,r){let i=t.chatConfig;if(!i)throw Error(`Chat config is required`);await Promise.all(e.map(async e=>{try{await r(e,t.chatContext.history,n.sharedState,i,t,n)}catch(r){let i=r instanceof Error?r:Error(String(r));n.errors.set(e.role,i),t.onAgentError?.(e.role,i)}}))}},We=class{createAgentContextWithPreviousAgents(e,t,n){return{...e,...t.callContext.getProxy(),previousAgents:Array.from(n.messages.entries()).map(([e,t])=>({role:e,content:t.content}))}}updateWorkflowState(e,t,n,r,i){return t.push(e),n={...n,...r,message:e},i.sharedState=n,{currentMessages:t,accumulatedState:n}}},Ge=class extends We{async execute(e,t,n,r){let i=t.chatConfig;if(!i)throw Error(`Chat config is required`);let a=[...t.chatContext.history],o={...n.sharedState};for(let s of e)try{let e=this.createAgentContextWithPreviousAgents(o,t,n),c=await r(s,a,o,i,t,n);if(!c)break;let l=this.updateWorkflowState(c,a,o,e,n);a=l.currentMessages,o=l.accumulatedState}catch(e){let r=e instanceof Error?e:Error(String(e));n.errors.set(s.role,r),t.onAgentError?.(s.role,r);break}}},Ke=class extends We{async execute(e,t,n,r){let i=t.chatConfig;if(!i)throw Error(`Chat config is required`);let a=[...t.chatContext.history],o={...n.sharedState};for(let s of e)try{let e=this.createAgentContextWithPreviousAgents(o,t,n);if(s.canHandle&&!s.canHandle(e))continue;let c=await r(s,a,o,i,t,n);if(!c)break;let l=this.updateWorkflowState(c,a,o,e,n);a=l.currentMessages,o=l.accumulatedState}catch(e){let r=e instanceof Error?e:Error(String(e));n.errors.set(s.role,r),t.onAgentError?.(s.role,r)}}},qe=class{async execute(e,t,n,r){let i=t.chatConfig;if(!i)throw Error(`Chat config is required`);let a=[...t.chatContext.history];for(let o of this.buildTopoOrder(e)){await Promise.all(o.map(async e=>{try{await r(e,a,n.sharedState,i,t,n)}catch(r){let i=r instanceof Error?r:Error(String(r));n.errors.set(e.role,i),t.onAgentError?.(e.role,i)}}));for(let e of o){let t=n.messages.get(e.role);t&&a.push(t)}}}buildTopoOrder(e){let t=[],n=new Set;for(;n.size<e.length;){let r=e.filter(t=>{if(n.has(t.role))return!1;if(!t.consumes?.length)return!0;let r=e.filter(e=>n.has(e.role)).flatMap(e=>e.produces||[]);return t.consumes.every(e=>r.includes(e))});if(r.length===0){t.push(e.filter(e=>!n.has(e.role)));break}t.push(r);for(let e of r)n.add(e.role)}return t}};function Je(e,t){let n=Date.now();return{id:`plan-${n}-${Math.random().toString(36).slice(2,9)}`,originalPrompt:e,steps:t.map(e=>({...e,status:`pending`,revisions:0})),status:`planning`,createdAt:n,updatedAt:n}}function Ye(e){let t=new Set(e.steps.filter(e=>e.status===`completed`).map(e=>e.id));return e.steps.filter(e=>e.status===`pending`&&e.dependsOn.every(e=>t.has(e)))}function Xe(e){return e.steps.every(e=>e.status===`completed`||e.status===`skipped`)}function Ze(e){return e.steps.some(e=>e.status===`failed`)}var Qe=`You are a task orchestrator. Given a user's complex request, decompose it into a structured execution plan.

Respond with ONLY a JSON object matching this schema (no markdown, no explanation):
{
  "steps": [
    {
      "id": "step-1",
      "role": "<agent role>",
      "subTask": "<specific instruction for this step>",
      "dependsOn": [],
      "consumes": [],
      "produces": ["<artifact-id>"]
    }
  ]
}

Rules:
- Each step must have a unique id (step-1, step-2, ...)
- "role" must match an available agent role
- "dependsOn" lists step IDs that must complete before this step
- "consumes" and "produces" are artifact IDs
- Steps with no dependencies can run in parallel
- Keep the plan minimal — only as many steps as needed`;async function $e(e){let t=[{role:`system`,content:`${Qe}\n\nAvailable agents:\n${e.availableAgents.filter(e=>!e.isOrchestrator).map(e=>`- ${e.role}: ${e.description}`).join(`
`)}`},{role:`user`,content:e.prompt}],n=await e.executeCompletion(t,e.chatConfig);try{let t=n.match(/\{[\s\S]*\}/);if(!t)throw Error(`No JSON found in orchestrator response`);let r=JSON.parse(t[0]);return Je(e.prompt,r.steps||[])}catch{let t=e.availableAgents.find(e=>!e.isOrchestrator);return Je(e.prompt,[{id:`step-1`,role:t?.role||`appsupport`,subTask:e.prompt,dependsOn:[],consumes:[],produces:[`step-1-result`]}])}}var et=class e{constructor(e,t){this.artifacts=new Map,this.mailbox=new Map,this.taskId=e,this.plan=t}putArtifact(e){this.artifacts.set(e.id,e)}getArtifact(e){return this.artifacts.get(e)}getArtifactsByType(e){return Array.from(this.artifacts.values()).filter(t=>t.type===e)}getArtifactsProducedBy(e){return Array.from(this.artifacts.values()).filter(t=>t.producedBy===e)}postMessage(e){let t=e.to===`*`?`__broadcast__`:e.to,n=this.mailbox.get(t)||[];n.push(e),this.mailbox.set(t,n)}readMessages(e){let t=this.mailbox.get(e)||[],n=this.mailbox.get(`__broadcast__`)||[];return[...t,...n]}clearMessages(e){this.mailbox.delete(e)}updateStepStatus(e,t,n){let r=this.plan.steps.find(t=>t.id===e);r&&(r.status=t,n&&(r.result=n,this.putArtifact(n)),this.plan.updatedAt=Date.now())}getNextRunnableSteps(){let e=new Set(this.plan.steps.filter(e=>e.status===`completed`).map(e=>e.id));return this.plan.steps.filter(t=>t.status===`pending`&&t.dependsOn.every(t=>e.has(t)))}toJSON(){return{taskId:this.taskId,plan:this.plan,artifacts:Array.from(this.artifacts.values()),mailbox:Object.fromEntries(this.mailbox.entries())}}static fromJSON(t){let n=new e(t.taskId,t.plan);for(let e of t.artifacts||[])n.artifacts.set(e.id,e);for(let[e,r]of Object.entries(t.mailbox||{}))n.mailbox.set(e,r);return n}},tt=`ai_task_checkpoint_`,nt=`ai_task_checkpoint_registry`,D=new class{async save(e){let t=`${tt}${e.taskId}`;await h.set(t,e.toJSON())}async restore(e){let t=`${tt}${e}`,n=await h.get(t);return n?et.fromJSON(n):null}async delete(e){let t=`${tt}${e}`;await h.set(t,void 0)}async listCheckpoints(){return this.getRegistry()}async registerCheckpoint(e){let t=await this.getRegistry();t.includes(e)||(t.push(e),await h.set(nt,t))}async unregisterCheckpoint(e){let t=await this.getRegistry();await h.set(nt,t.filter(t=>t!==e))}async getRegistry(){return await h.get(nt)||[]}},rt=class{constructor(e){this.executeStep=e}async run(e,t){let n=e.plan;n.status=`running`,await D.save(e);let r=new Map;for(;;){if(t.signal?.aborted){n.status=`paused`;break}let i=Ye(n);if(i.length===0)break;if(await Promise.all(i.map(async n=>{e.updateStepStatus(n.id,`running`),t.onStepStart?.(n);try{let r=await this.executeStep(n,e,t);e.updateStepStatus(n.id,`completed`,r),t.onStepComplete?.(n,r),await D.save(e)}catch(i){let a=i instanceof Error?i:Error(String(i));e.updateStepStatus(n.id,`failed`),r.set(n.id,a),t.onStepError?.(n,a)}})),Ze(n)){n.status=`failed`;break}if(Xe(n)){n.status=`completed`;break}}return{plan:n,artifacts:n.steps.filter(e=>e.result).map(e=>e.result),errors:r}}},it=class{async execute(e,t,n,r){let i=t.chatConfig;if(!i)throw Error(`Chat config is required`);let a=t.chatContext.history[t.chatContext.history.length-1]?.content||``,o=new T,s=await $e({prompt:a,availableAgents:e,chatConfig:i,context:t.callContext.getProxy(),executeCompletion:(e,t)=>we(e,t,o)}),c=new et(`wf-${Date.now()}`,s),l=new Map(e.map(e=>[e.role,e])),u=(await new rt(async(a,o,s)=>{let c=(await r(l.get(a.role)||e[0],[...t.chatContext.history,{role:`user`,content:a.subTask}],n.sharedState,i,t,n))?.content||``;return{id:a.produces[0]||`${a.id}-result`,type:`text`,content:c,producedBy:a.role,createdAt:Date.now()}}).run(c,{prompt:a,chatConfig:i,callContext:t.callContext,signal:t.signal})).artifacts.map(e=>e.content).filter(Boolean).join(`

`);u&&n.messages.set(`orchestrator`,{role:`assistant`,content:u})}},at=`You are a quality reviewer. Evaluate the provided artifact against the original task.

Respond with ONLY a JSON object:
{
  "verdict": "approved" | "needs-revision",
  "score": 0-100,
  "notes": "<feedback for revision, empty if approved>"
}`;async function ot(e){let t=[{role:`system`,content:at},{role:`user`,content:`Original task: ${e.originalTask}\n\nArtifact to review:\n${e.artifact.content}`}];try{let n=(await e.executeCompletion(t,e.chatConfig)).match(/\{[\s\S]*\}/);if(!n)throw Error(`No JSON in reviewer response`);let r=JSON.parse(n[0]);return{verdict:r.verdict===`approved`?`approved`:`needs-revision`,score:typeof r.score==`number`?r.score:50,notes:r.notes||``}}catch{return{verdict:`approved`,score:70,notes:``}}}var st=class{async execute(e,t,n,r){let i=t.chatConfig;if(!i)throw Error(`Chat config is required`);let a=new T,o=e[0],s=e.find(e=>e.reviewerFor?.includes(o.role)),c=o.maxRevisions??2,l=[...t.chatContext.history],u=0;for(;u<=c;){let e=await r(o,l,n.sharedState,i,t,n);if(!e)break;if(!s){n.messages.set(o.role,e);break}let d=await ot({artifact:{id:`draft-${u}`,type:`text`,content:e.content,producedBy:o.role,createdAt:Date.now()},originalTask:t.chatContext.history[t.chatContext.history.length-1]?.content||``,chatConfig:i,executeCompletion:(e,t)=>we(e,t,a)});if(d.verdict===`approved`||u>=c){n.messages.set(o.role,e);break}l=[...t.chatContext.history,e,{role:`user`,content:`Please revise based on this feedback: ${d.notes}`}],u++}}},ct=class{constructor(){this.strategies=new Map([[`parallel`,new Ue],[`sequential`,new Ge],[`conditional`,new Ke],[`pipeline`,new qe],[`orchestrated`,new it],[`review`,new st]])}registerStrategy(e,t){this.strategies.set(e,t)}async execute(e,t,n){let r=`workflow-${Date.now()}-${Math.random()}`,i=t.execution||`parallel`,a={messages:new Map,sharedState:{...t.sharedState||{}},errors:new Map};S(he,{workflowId:r,options:t});try{let o=this.strategies.get(i);if(!o)throw Error(`Unknown workflow execution strategy: ${i}`);return await o.execute(e,t,a,n),S(ge,{workflowId:r,results:a}),a}catch(e){let t=e instanceof Error?e:Error(String(e));throw S(_e,{workflowId:r,error:t}),t}}},lt=class{static{this.AVERAGE_CHARS_PER_TOKEN=4}static{this.TOOL_DEFINITION_OVERHEAD=50}static{this.TOOL_CALL_OVERHEAD=10}static{this.MESSAGE_OVERHEAD=4}static estimateTokens(e){if(e==null)return 0;let t=``;if(typeof e==`string`)t=e;else if(typeof e==`number`||typeof e==`boolean`||typeof e==`bigint`)t=String(e);else if(typeof e==`object`)try{t=JSON.stringify(e)}catch{return 0}else return 0;let n=t.trim();return n?Math.max(1,Math.ceil(n.length/this.AVERAGE_CHARS_PER_TOKEN+n.split(/\s+/).filter(e=>e.length>0).length*.3)):0}static estimateMessageTokens(e){let t=this.MESSAGE_OVERHEAD;if(e.content&&(t+=this.estimateTokens(e.content)),e.role&&(t+=this.estimateTokens(e.role)),e.tool_calls)for(let n of e.tool_calls)t+=this.estimateTokens(n.function.name||``)+this.estimateTokens(n.function.arguments||`{}`)+this.TOOL_CALL_OVERHEAD;return e.tool_call_id&&(t+=this.estimateTokens(e.tool_call_id)),t}static estimatePromptTokens(e,t){let n=e.reduce((e,t)=>e+this.estimateMessageTokens(t),0);if(t?.length)for(let e of t)n+=this.TOOL_DEFINITION_OVERHEAD,n+=this.estimateTokens(e.function.name||``),n+=this.estimateTokens(e.function.description||``),e.function.parameters&&(n+=this.estimateTokens(JSON.stringify(e.function.parameters)));return n}static estimateCompletionTokens(e,t){let n=this.estimateTokens(e);if(t?.length)for(let e of t)n+=this.TOOL_CALL_OVERHEAD+this.estimateTokens(e.function?.name||``)+this.estimateTokens(e.function?.arguments||`{}`);return n}},ut=`ai_token_usage`,O={promptTokens:0,completionTokens:0,totalTokens:0,requestCount:0},dt=new class{constructor(){this.data=null,this.loadPromise=null}async loadData(){return this.data?this.data:(this.loadPromise||=(async()=>{let e=await oe.getObject(ut);return this.data=e||{providers:{},total:{...O},lastUpdated:Date.now()},this.data||(this.data={providers:{},total:{...O},lastUpdated:Date.now()},await this.saveData()),this.loadPromise=null,this.data})(),this.loadPromise)}async saveData(){this.data&&(this.data.lastUpdated=Date.now(),await oe.persistObject(ut,this.data))}async recordUsage(e,t){if(await this.loadData(),!this.data)return;this.data.providers[e]??={...O};let n=this.data.providers[e];n.promptTokens+=t.promptTokens,n.completionTokens+=t.completionTokens,n.totalTokens+=t.totalTokens,n.requestCount+=1,this.data.total.promptTokens+=t.promptTokens,this.data.total.completionTokens+=t.completionTokens,this.data.total.totalTokens+=t.totalTokens,this.data.total.requestCount+=1,await this.saveData()}async getProviderUsage(e){return await this.loadData(),this.data?.providers[e]||null}async getAllProviderUsage(){return await this.loadData(),this.data?.providers||{}}async getTotalUsage(){return await this.loadData(),this.data?.total||{...O}}async reset(){this.data={providers:{},total:{...O},lastUpdated:Date.now()},await this.saveData()}async resetProvider(e){if(await this.loadData(),!this.data)return;let t=this.data.providers[e];t&&(this.data.total.promptTokens-=t.promptTokens,this.data.total.completionTokens-=t.completionTokens,this.data.total.totalTokens-=t.totalTokens,this.data.total.requestCount-=t.requestCount,delete this.data.providers[e],await this.saveData())}},k=new class{constructor(){this.activeRequests=new Map,this.activeTasks=new Map,this.toolRegistry=new He,this.providerFactory=new T,this.agentRegistry=new ke,this._promptBuilder=new Re(this.toolRegistry),this.messageProcessor=new ze,this.toolExecutor=new Ve,this.workflowEngine=new ct,b(ee,()=>{this.aiConfig=void 0,this.configCheckPromise=void 0,this.checkAIConfig().then()}),this.checkAIConfig().then()}get promptBuilder(){return this._promptBuilder}getAgentContributions(){return this.agentRegistry.getAgentContributions()}async getProviders(){return await this.checkAIConfig(),this.aiConfig?.providers||[]}async getDefaultProvider(){await this.checkAIConfig();let e=await this.getProviders();if(this.aiConfig?.defaultProvider){let t=e.find(e=>e.name===this.aiConfig?.defaultProvider);if(t)return t}return e[0]}async setDefaultProvider(e){return await this.checkAIConfig(),this.aiConfig&&(this.aiConfig.defaultProvider=e,await h.set(w,this.aiConfig)),this.getDefaultProvider()}createMessage(e){return{role:`user`,content:e}}registerStreamingFetcher(e){this.providerFactory.registerProvider(e)}getContributedProviders(){return n.getContributions(C).map(e=>e.provider)}mergeProviders(e,t){let n=new Set(e.map(e=>e.name)),r=t.filter(e=>!n.has(e.name));return r.length>0?[...e,...r]:e}async createInitialConfig(){let e={...be,providers:this.getContributedProviders()};return await h.set(w,e),h.get(w)}async updateConfigWithMissingProviders(e){let t=this.mergeProviders(e.providers,this.getContributedProviders());if(t.length===e.providers.length)return e;let n={...e,providers:t};return await h.set(w,n),n}async checkAIConfig(){if(!this.aiConfig)return this.configCheckPromise||=this.performConfigCheck(),this.configCheckPromise}async performConfigCheck(){try{this.aiConfig=await h.get(w),this.aiConfig=this.aiConfig?await this.updateConfigWithMissingProviders(this.aiConfig):await this.createInitialConfig(),S(me,this.aiConfig)}finally{this.configCheckPromise=void 0}}createAgentContext(e,t,n={}){return{...e,...t.getProxy(),...n}}async*streamCompletion(e){let t=`${Date.now()}-${Math.random()}`,n=new AbortController;this.activeRequests.set(t,n),e.signal&&e.signal.addEventListener(`abort`,()=>n.abort());let r=e.signal||n.signal;try{e.onStatus?.(`starting`),S(ue,{requestId:t,options:e});let n=e.chatConfig||await this.getDefaultProvider(),i=je(e.chatContext.history),a=this.providerFactory.getProvider(n),o=this.toolExecutor.createToolCallAccumulator(),s=``,c=`assistant`,l;for await(let u of a.stream({model:n.model,messages:i,chatConfig:n,tools:e.tools,signal:r})){if(u.type===`error`){e.onStatus?.(`error`),S(pe,{requestId:t,chunk:u}),yield u;break}if(u.type===`token`)o.processChunk(u),u.toolCalls?.length||(s+=u.content),u.message?.role&&(c=u.message.role),u.content&&e.onToken?.(u.content),e.onStatus?.(`streaming`),e.onProgress?.({received:s.length}),S(de,{requestId:t,chunk:u}),yield u;else if(u.type===`done`){u.metadata?.usage&&(l=u.metadata.usage),e.onStatus?.(`complete`),S(fe,{requestId:t}),yield u;break}else yield u}let u=o.getFinalToolCalls(),d={role:c,content:s,...u.length>0&&{toolCalls:u}};if(!l){let t=lt.estimatePromptTokens(i,e.tools),n=lt.estimateCompletionTokens(s,u);l={promptTokens:t,completionTokens:n,totalTokens:t+n,estimated:!0}}return dt.recordUsage(n.name,l).catch(e=>{ce.error(`Failed to record token usage: ${e instanceof Error?e.message:String(e)}`)}),{message:d,tokenUsage:l}}catch(n){if(n instanceof Error&&n.name===`AbortError`)throw e.onStatus?.(`error`),S(pe,{requestId:t,error:`Request cancelled`}),n;e.onStatus?.(`error`);let r=n instanceof Error?n.message:String(n);throw S(pe,{requestId:t,error:r}),yield{type:`error`,content:r,metadata:{error:n}},n}finally{this.activeRequests.delete(t)}}async handleStreamingPromptDirect(e){let t=this.streamCompletion(e),n;for(;;){if(n=await t.next(),n.done)return n.value.message;let e=n.value;if(e.type===`error`)throw Error(e.content);if(e.type===`done`){let e=await t.next();if(e.done&&e.value)return e.value.message;if(!e.done)continue;throw Error(`Stream completed without return value`)}}}async handleStreamingPrompt(e){let t=e.callContext||x.createChild({}),n=this.createAgentContext({},t,{userPrompt:e.chatContext.history[e.chatContext.history.length-1]?.content||``}),r=this.agentRegistry.getMatchingAgents(n),i=r.length>0?r.map(e=>e.role):[`assistant`],a=await this.executeAgentWorkflow({chatContext:e.chatContext,chatConfig:e.chatConfig,callContext:t,execution:`parallel`,stream:e.stream,signal:e.signal,onToken:(t,n)=>e.onToken?.(n),onStatus:(t,n)=>e.onStatus?.(n),roles:i}),o=Array.from(a.messages.values());return o.length===1?o[0]:o}cancelRequest(e){let t=this.activeRequests.get(e);return t?(t.abort(),this.activeRequests.delete(e),!0):!1}async executeAgentWorkflow(e){let t=this.createAgentContext(e.sharedState||{},e.callContext),n=this.agentRegistry.getMatchingAgents(t,e.roles);return this.workflowEngine.execute(n,e,(e,t,n,r,i,a)=>this.executeAgent(e,t,n,r,i,a))}async executeAgent(e,t,n,r,i,a){i.onAgentStart?.(e.role);let o=this.createAgentContext(n,i.callContext,{userPrompt:t[t.length-1]?.content||``}),{messages:s,tools:c}=await this._promptBuilder.build(e,t,o,e.hooks),l=s.map(e=>{let t={role:e.role,content:e.content};return e.tool_call_id&&(t.tool_call_id=e.tool_call_id),e.tool_calls&&(t.tool_calls=e.tool_calls),t}),u=await this.handleStreamingPromptDirect({chatContext:{history:l},chatConfig:r,callContext:i.callContext,stream:i.stream??!0,signal:i.signal,onToken:i.onToken?t=>i.onToken(e.role,t):void 0,tools:c}),d=0,f=[...s];for(;u.toolCalls&&u.toolCalls.length>0;){if(d++,d>10){ce.warn(`Max tool call iterations reached`);break}let t;if(i.requireToolApproval&&i.onToolApprovalRequest){let n=u.toolCalls.map(e=>{let t={};try{t=JSON.parse(e.function.arguments||`{}`)}catch{}return`${e.function.name}(${Object.entries(t).map(([e,t])=>`${e}=${t}`).join(`, `)})`}).join(`, `),r={toolCalls:u.toolCalls,message:`The AI wants to execute: ${n}`};t=await i.onToolApprovalRequest(e.role,r)?await this.toolExecutor.executeToolCalls(u.toolCalls,o):u.toolCalls.map(e=>({id:e.id,result:{success:!1,message:`Tool execution cancelled by user`,cancelled:!0}}))}else t=await this.toolExecutor.executeToolCalls(u.toolCalls,o);let n=t.map(e=>({role:`tool`,content:e.error?JSON.stringify({error:e.error}):JSON.stringify(e.result),tool_call_id:e.id})),a={role:`assistant`,content:u.content||``};if(u.toolCalls?.length&&(a.tool_calls=u.toolCalls.filter(e=>e.function.name?.trim()).map(e=>({id:e.id,type:e.type,function:{name:e.function.name,arguments:e.function.arguments||`{}`}}))),f.push(a,...n),u=await this.handleStreamingPromptDirect({chatContext:{history:f.map(e=>({role:e.role,content:e.content,...e.tool_call_id&&{tool_call_id:e.tool_call_id},...e.tool_calls&&{tool_calls:e.tool_calls}}))},chatConfig:r,callContext:i.callContext,stream:i.stream??!0,signal:i.signal,tools:c}),u.content?.trim()&&!u.toolCalls?.length)break}let p=await this.messageProcessor.process(u,e,this.createAgentContext(n,i.callContext,{message:u}));e.hooks?.afterReceive&&await e.hooks.afterReceive(p,this.createAgentContext(n,i.callContext));let m={role:e.role,content:p.content};return a.messages.set(e.role,m),i.onAgentComplete?.(e.role,m),m}async planTask(e,t){let n=await this.getDefaultProvider(),r=this.agentRegistry.getAgentContributions();return x.createChild({}),$e({prompt:e,availableAgents:r,chatConfig:n,context:t,executeCompletion:(e,t)=>we(e,t,this.providerFactory)})}async executeTask(e){let t=e.chatConfig||await this.getDefaultProvider(),n=e.callContext||x.createChild({}),r=this.agentRegistry.getAgentContributions(),i=await this.planTask(e.prompt,n.getProxy());e.onPlanReady?.(i);let a=new et(`task-${Date.now()}`,i);await D.registerCheckpoint(a.taskId);let o=new AbortController;this.activeTasks.set(a.taskId,o);let s={...e,signal:e.signal??o.signal},c=new Map(r.map(e=>[e.role,e])),l=new rt(this.createStepExecutor(c,r,t,n,s));try{let e=await l.run(a,s);return await D.unregisterCheckpoint(a.taskId),e}finally{this.activeTasks.delete(a.taskId)}}async resumeTask(e,t){let n=await D.restore(e);if(!n)throw Error(`No checkpoint found for task ${e}`);let r=t.chatConfig||await this.getDefaultProvider(),i=t.callContext||x.createChild({}),a=this.agentRegistry.getAgentContributions(),o=new Map(a.map(e=>[e.role,e]));return new rt(this.createStepExecutor(o,a,r,i,t)).run(n,t)}createStepExecutor(e,t,n,r,i){return async(a,o,s)=>{let c=e.get(a.role)||t[0],l=[...i.chatContext?.history||[],{role:`user`,content:a.subTask}],u=(await this.workflowEngine.execute([c],{chatContext:{history:l},chatConfig:n,callContext:r,execution:`parallel`,stream:!0,signal:i.signal,roles:[c.role]},(e,t,n,r,i,a)=>this.executeAgent(e,t,n,r,i,a))).messages.get(c.role);return{id:a.produces[0]||`${a.id}-result`,type:`text`,content:u?.content||``,producedBy:a.role,createdAt:Date.now()}}}cancelTask(e){let t=this.activeTasks.get(e);t&&(t.abort(),this.activeTasks.delete(e))}};function ft(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var A=ft();function pt(e){A=e}var j={exec:()=>null};function M(e,t=``){let n=typeof e==`string`?e:e.source,r={replace:(e,t)=>{let i=typeof t==`string`?t:t.source;return i=i.replace(N.caret,`$1`),n=n.replace(e,i),r},getRegex:()=>new RegExp(n,t)};return r}var mt=(()=>{try{return!0}catch{return!1}})(),N={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceTabs:/^\t+/,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] /,listReplaceTask:/^\[[ xX]\] +/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,unescapeTest:/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/gi,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:e=>RegExp(`^( {0,3}${e})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:e=>RegExp(`^ {0,${Math.min(3,e-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),hrRegex:e=>RegExp(`^ {0,${Math.min(3,e-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),fencesBeginRegex:e=>RegExp(`^ {0,${Math.min(3,e-1)}}(?:\`\`\`|~~~)`),headingBeginRegex:e=>RegExp(`^ {0,${Math.min(3,e-1)}}#`),htmlBeginRegex:e=>RegExp(`^ {0,${Math.min(3,e-1)}}<(?:[a-z].*>|!--)`,`i`)},ht=/^(?:[ \t]*(?:\n|$))+/,gt=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,_t=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,P=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,vt=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,yt=/(?:[*+-]|\d{1,9}[.)])/,bt=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,xt=M(bt).replace(/bull/g,yt).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,``).getRegex(),St=M(bt).replace(/bull/g,yt).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),Ct=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,wt=/^[^\n]+/,Tt=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,Et=M(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace(`label`,Tt).replace(`title`,/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),Dt=M(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,yt).getRegex(),F=`address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul`,Ot=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,kt=M(`^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))`,`i`).replace(`comment`,Ot).replace(`tag`,F).replace(`attribute`,/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),At=M(Ct).replace(`hr`,P).replace(`heading`,` {0,3}#{1,6}(?:\\s|$)`).replace(`|lheading`,``).replace(`|table`,``).replace(`blockquote`,` {0,3}>`).replace(`fences`," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace(`list`,` {0,3}(?:[*+-]|1[.)]) `).replace(`html`,`</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)`).replace(`tag`,F).getRegex(),jt={blockquote:M(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace(`paragraph`,At).getRegex(),code:gt,def:Et,fences:_t,heading:vt,hr:P,html:kt,lheading:xt,list:Dt,newline:ht,paragraph:At,table:j,text:wt},Mt=M(`^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)`).replace(`hr`,P).replace(`heading`,` {0,3}#{1,6}(?:\\s|$)`).replace(`blockquote`,` {0,3}>`).replace(`code`,`(?: {4}| {0,3}	)[^\\n]`).replace(`fences`," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace(`list`,` {0,3}(?:[*+-]|1[.)]) `).replace(`html`,`</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)`).replace(`tag`,F).getRegex(),Nt={...jt,lheading:St,table:Mt,paragraph:M(Ct).replace(`hr`,P).replace(`heading`,` {0,3}#{1,6}(?:\\s|$)`).replace(`|lheading`,``).replace(`table`,Mt).replace(`blockquote`,` {0,3}>`).replace(`fences`," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace(`list`,` {0,3}(?:[*+-]|1[.)]) `).replace(`html`,`</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)`).replace(`tag`,F).getRegex()},Pt={...jt,html:M(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace(`comment`,Ot).replace(/tag/g,`(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b`).getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:j,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:M(Ct).replace(`hr`,P).replace(`heading`,` *#{1,6} *[^
]`).replace(`lheading`,xt).replace(`|table`,``).replace(`blockquote`,` {0,3}>`).replace(`|fences`,``).replace(`|list`,``).replace(`|html`,``).replace(`|tag`,``).getRegex()},Ft=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,It=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,Lt=/^( {2,}|\\)\n(?!\s*$)/,Rt=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,I=/[\p{P}\p{S}]/u,zt=/[\s\p{P}\p{S}]/u,Bt=/[^\s\p{P}\p{S}]/u,Vt=M(/^((?![*_])punctSpace)/,`u`).replace(/punctSpace/g,zt).getRegex(),Ht=/(?!~)[\p{P}\p{S}]/u,Ut=/(?!~)[\s\p{P}\p{S}]/u,Wt=/(?:[^\s\p{P}\p{S}]|~)/u,Gt=M(/link|precode-code|html/,`g`).replace(`link`,/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace(`precode-`,mt?"(?<!`)()":"(^^|[^`])").replace(`code`,/(?<b>`+)[^`]+\k<b>(?!`)/).replace(`html`,/<(?! )[^<>]*?>/).getRegex(),Kt=/^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,qt=M(Kt,`u`).replace(/punct/g,I).getRegex(),Jt=M(Kt,`u`).replace(/punct/g,Ht).getRegex(),Yt=`^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)`,Xt=M(Yt,`gu`).replace(/notPunctSpace/g,Bt).replace(/punctSpace/g,zt).replace(/punct/g,I).getRegex(),Zt=M(Yt,`gu`).replace(/notPunctSpace/g,Wt).replace(/punctSpace/g,Ut).replace(/punct/g,Ht).getRegex(),Qt=M(`^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)`,`gu`).replace(/notPunctSpace/g,Bt).replace(/punctSpace/g,zt).replace(/punct/g,I).getRegex(),$t=M(/\\(punct)/,`gu`).replace(/punct/g,I).getRegex(),en=M(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace(`scheme`,/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace(`email`,/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),tn=M(Ot).replace(`(?:-->|$)`,`-->`).getRegex(),nn=M(`^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>`).replace(`comment`,tn).replace(`attribute`,/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),L=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+[^`]*?`+(?!`)|[^\[\]\\`])*?/,rn=M(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace(`label`,L).replace(`href`,/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace(`title`,/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),an=M(/^!?\[(label)\]\[(ref)\]/).replace(`label`,L).replace(`ref`,Tt).getRegex(),on=M(/^!?\[(ref)\](?:\[\])?/).replace(`ref`,Tt).getRegex(),sn=M(`reflink|nolink(?!\\()`,`g`).replace(`reflink`,an).replace(`nolink`,on).getRegex(),cn=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,ln={_backpedal:j,anyPunctuation:$t,autolink:en,blockSkip:Gt,br:Lt,code:It,del:j,emStrongLDelim:qt,emStrongRDelimAst:Xt,emStrongRDelimUnd:Qt,escape:Ft,link:rn,nolink:on,punctuation:Vt,reflink:an,reflinkSearch:sn,tag:nn,text:Rt,url:j},un={...ln,link:M(/^!?\[(label)\]\((.*?)\)/).replace(`label`,L).getRegex(),reflink:M(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace(`label`,L).getRegex()},dn={...ln,emStrongRDelimAst:Zt,emStrongLDelim:Jt,url:M(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace(`protocol`,cn).replace(`email`,/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:M(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace(`protocol`,cn).getRegex()},fn={...dn,br:M(Lt).replace(`{2,}`,`*`).getRegex(),text:M(dn.text).replace(`\\b_`,`\\b_| {2,}\\n`).replace(/\{2,\}/g,`*`).getRegex()},R={normal:jt,gfm:Nt,pedantic:Pt},z={normal:ln,gfm:dn,breaks:fn,pedantic:un},pn={"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`},mn=e=>pn[e];function B(e,t){if(t){if(N.escapeTest.test(e))return e.replace(N.escapeReplace,mn)}else if(N.escapeTestNoEncode.test(e))return e.replace(N.escapeReplaceNoEncode,mn);return e}function hn(e){try{e=encodeURI(e).replace(N.percentDecode,`%`)}catch{return null}return e}function gn(e,t){let n=e.replace(N.findPipe,(e,t,n)=>{let r=!1,i=t;for(;--i>=0&&n[i]===`\\`;)r=!r;return r?`|`:` |`}).split(N.splitPipe),r=0;if(n[0].trim()||n.shift(),n.length>0&&!n.at(-1)?.trim()&&n.pop(),t)if(n.length>t)n.splice(t);else for(;n.length<t;)n.push(``);for(;r<n.length;r++)n[r]=n[r].trim().replace(N.slashPipe,`|`);return n}function V(e,t,n){let r=e.length;if(r===0)return``;let i=0;for(;i<r;){let a=e.charAt(r-i-1);if(a===t&&!n)i++;else if(a!==t&&n)i++;else break}return e.slice(0,r-i)}function _n(e,t){if(e.indexOf(t[1])===-1)return-1;let n=0;for(let r=0;r<e.length;r++)if(e[r]===`\\`)r++;else if(e[r]===t[0])n++;else if(e[r]===t[1]&&(n--,n<0))return r;return n>0?-2:-1}function vn(e,t,n,r,i){let a=t.href,o=t.title||null,s=e[1].replace(i.other.outputLinkReplace,`$1`);r.state.inLink=!0;let c={type:e[0].charAt(0)===`!`?`image`:`link`,raw:n,href:a,title:o,text:s,tokens:r.inlineTokens(s)};return r.state.inLink=!1,c}function yn(e,t,n){let r=e.match(n.other.indentCodeCompensation);if(r===null)return t;let i=r[1];return t.split(`
`).map(e=>{let t=e.match(n.other.beginningSpace);if(t===null)return e;let[r]=t;return r.length>=i.length?e.slice(i.length):e}).join(`
`)}var H=class{options;rules;lexer;constructor(e){this.options=e||A}space(e){let t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:`space`,raw:t[0]}}code(e){let t=this.rules.block.code.exec(e);if(t){let e=t[0].replace(this.rules.other.codeRemoveIndent,``);return{type:`code`,raw:t[0],codeBlockStyle:`indented`,text:this.options.pedantic?e:V(e,`
`)}}}fences(e){let t=this.rules.block.fences.exec(e);if(t){let e=t[0],n=yn(e,t[3]||``,this.rules);return{type:`code`,raw:e,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,`$1`):t[2],text:n}}}heading(e){let t=this.rules.block.heading.exec(e);if(t){let e=t[2].trim();if(this.rules.other.endingHash.test(e)){let t=V(e,`#`);(this.options.pedantic||!t||this.rules.other.endingSpaceChar.test(t))&&(e=t.trim())}return{type:`heading`,raw:t[0],depth:t[1].length,text:e,tokens:this.lexer.inline(e)}}}hr(e){let t=this.rules.block.hr.exec(e);if(t)return{type:`hr`,raw:V(t[0],`
`)}}blockquote(e){let t=this.rules.block.blockquote.exec(e);if(t){let e=V(t[0],`
`).split(`
`),n=``,r=``,i=[];for(;e.length>0;){let t=!1,a=[],o;for(o=0;o<e.length;o++)if(this.rules.other.blockquoteStart.test(e[o]))a.push(e[o]),t=!0;else if(!t)a.push(e[o]);else break;e=e.slice(o);let s=a.join(`
`),c=s.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,``);n=n?`${n}
${s}`:s,r=r?`${r}
${c}`:c;let l=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(c,i,!0),this.lexer.state.top=l,e.length===0)break;let u=i.at(-1);if(u?.type===`code`)break;if(u?.type===`blockquote`){let t=u,a=t.raw+`
`+e.join(`
`),o=this.blockquote(a);i[i.length-1]=o,n=n.substring(0,n.length-t.raw.length)+o.raw,r=r.substring(0,r.length-t.text.length)+o.text;break}else if(u?.type===`list`){let t=u,a=t.raw+`
`+e.join(`
`),o=this.list(a);i[i.length-1]=o,n=n.substring(0,n.length-u.raw.length)+o.raw,r=r.substring(0,r.length-t.raw.length)+o.raw,e=a.substring(i.at(-1).raw.length).split(`
`);continue}}return{type:`blockquote`,raw:n,tokens:i,text:r}}}list(e){let t=this.rules.block.list.exec(e);if(t){let n=t[1].trim(),r=n.length>1,i={type:`list`,raw:``,ordered:r,start:r?+n.slice(0,-1):``,loose:!1,items:[]};n=r?`\\d{1,9}\\${n.slice(-1)}`:`\\${n}`,this.options.pedantic&&(n=r?n:`[*+-]`);let a=this.rules.other.listItemRegex(n),o=!1;for(;e;){let n=!1,r=``,s=``;if(!(t=a.exec(e))||this.rules.block.hr.test(e))break;r=t[0],e=e.substring(r.length);let c=t[2].split(`
`,1)[0].replace(this.rules.other.listReplaceTabs,e=>` `.repeat(3*e.length)),l=e.split(`
`,1)[0],u=!c.trim(),d=0;if(this.options.pedantic?(d=2,s=c.trimStart()):u?d=t[1].length+1:(d=t[2].search(this.rules.other.nonSpaceChar),d=d>4?1:d,s=c.slice(d),d+=t[1].length),u&&this.rules.other.blankLine.test(l)&&(r+=l+`
`,e=e.substring(l.length+1),n=!0),!n){let t=this.rules.other.nextBulletRegex(d),n=this.rules.other.hrRegex(d),i=this.rules.other.fencesBeginRegex(d),a=this.rules.other.headingBeginRegex(d),o=this.rules.other.htmlBeginRegex(d);for(;e;){let f=e.split(`
`,1)[0],p;if(l=f,this.options.pedantic?(l=l.replace(this.rules.other.listReplaceNesting,`  `),p=l):p=l.replace(this.rules.other.tabCharGlobal,`    `),i.test(l)||a.test(l)||o.test(l)||t.test(l)||n.test(l))break;if(p.search(this.rules.other.nonSpaceChar)>=d||!l.trim())s+=`
`+p.slice(d);else{if(u||c.replace(this.rules.other.tabCharGlobal,`    `).search(this.rules.other.nonSpaceChar)>=4||i.test(c)||a.test(c)||n.test(c))break;s+=`
`+l}!u&&!l.trim()&&(u=!0),r+=f+`
`,e=e.substring(f.length+1),c=p.slice(d)}}i.loose||(o?i.loose=!0:this.rules.other.doubleBlankLine.test(r)&&(o=!0));let f=null,p;this.options.gfm&&(f=this.rules.other.listIsTask.exec(s),f&&(p=f[0]!==`[ ] `,s=s.replace(this.rules.other.listReplaceTask,``))),i.items.push({type:`list_item`,raw:r,task:!!f,checked:p,loose:!1,text:s,tokens:[]}),i.raw+=r}let s=i.items.at(-1);if(s)s.raw=s.raw.trimEnd(),s.text=s.text.trimEnd();else return;i.raw=i.raw.trimEnd();for(let e=0;e<i.items.length;e++)if(this.lexer.state.top=!1,i.items[e].tokens=this.lexer.blockTokens(i.items[e].text,[]),!i.loose){let t=i.items[e].tokens.filter(e=>e.type===`space`);i.loose=t.length>0&&t.some(e=>this.rules.other.anyLine.test(e.raw))}if(i.loose)for(let e=0;e<i.items.length;e++)i.items[e].loose=!0;return i}}html(e){let t=this.rules.block.html.exec(e);if(t)return{type:`html`,block:!0,raw:t[0],pre:t[1]===`pre`||t[1]===`script`||t[1]===`style`,text:t[0]}}def(e){let t=this.rules.block.def.exec(e);if(t){let e=t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal,` `),n=t[2]?t[2].replace(this.rules.other.hrefBrackets,`$1`).replace(this.rules.inline.anyPunctuation,`$1`):``,r=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,`$1`):t[3];return{type:`def`,tag:e,raw:t[0],href:n,title:r}}}table(e){let t=this.rules.block.table.exec(e);if(!t||!this.rules.other.tableDelimiter.test(t[2]))return;let n=gn(t[1]),r=t[2].replace(this.rules.other.tableAlignChars,``).split(`|`),i=t[3]?.trim()?t[3].replace(this.rules.other.tableRowBlankLine,``).split(`
`):[],a={type:`table`,raw:t[0],header:[],align:[],rows:[]};if(n.length===r.length){for(let e of r)this.rules.other.tableAlignRight.test(e)?a.align.push(`right`):this.rules.other.tableAlignCenter.test(e)?a.align.push(`center`):this.rules.other.tableAlignLeft.test(e)?a.align.push(`left`):a.align.push(null);for(let e=0;e<n.length;e++)a.header.push({text:n[e],tokens:this.lexer.inline(n[e]),header:!0,align:a.align[e]});for(let e of i)a.rows.push(gn(e,a.header.length).map((e,t)=>({text:e,tokens:this.lexer.inline(e),header:!1,align:a.align[t]})));return a}}lheading(e){let t=this.rules.block.lheading.exec(e);if(t)return{type:`heading`,raw:t[0],depth:t[2].charAt(0)===`=`?1:2,text:t[1],tokens:this.lexer.inline(t[1])}}paragraph(e){let t=this.rules.block.paragraph.exec(e);if(t){let e=t[1].charAt(t[1].length-1)===`
`?t[1].slice(0,-1):t[1];return{type:`paragraph`,raw:t[0],text:e,tokens:this.lexer.inline(e)}}}text(e){let t=this.rules.block.text.exec(e);if(t)return{type:`text`,raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){let t=this.rules.inline.escape.exec(e);if(t)return{type:`escape`,raw:t[0],text:t[1]}}tag(e){let t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:`html`,raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){let t=this.rules.inline.link.exec(e);if(t){let e=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(e)){if(!this.rules.other.endAngleBracket.test(e))return;let t=V(e.slice(0,-1),`\\`);if((e.length-t.length)%2==0)return}else{let e=_n(t[2],`()`);if(e===-2)return;if(e>-1){let n=(t[0].indexOf(`!`)===0?5:4)+t[1].length+e;t[2]=t[2].substring(0,e),t[0]=t[0].substring(0,n).trim(),t[3]=``}}let n=t[2],r=``;if(this.options.pedantic){let e=this.rules.other.pedanticHrefTitle.exec(n);e&&(n=e[1],r=e[3])}else r=t[3]?t[3].slice(1,-1):``;return n=n.trim(),this.rules.other.startAngleBracket.test(n)&&(n=this.options.pedantic&&!this.rules.other.endAngleBracket.test(e)?n.slice(1):n.slice(1,-1)),vn(t,{href:n&&n.replace(this.rules.inline.anyPunctuation,`$1`),title:r&&r.replace(this.rules.inline.anyPunctuation,`$1`)},t[0],this.lexer,this.rules)}}reflink(e,t){let n;if((n=this.rules.inline.reflink.exec(e))||(n=this.rules.inline.nolink.exec(e))){let e=t[(n[2]||n[1]).replace(this.rules.other.multipleSpaceGlobal,` `).toLowerCase()];if(!e){let e=n[0].charAt(0);return{type:`text`,raw:e,text:e}}return vn(n,e,n[0],this.lexer,this.rules)}}emStrong(e,t,n=``){let r=this.rules.inline.emStrongLDelim.exec(e);if(!(!r||r[3]&&n.match(this.rules.other.unicodeAlphaNumeric))&&(!(r[1]||r[2])||!n||this.rules.inline.punctuation.exec(n))){let n=[...r[0]].length-1,i,a,o=n,s=0,c=r[0][0]===`*`?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(c.lastIndex=0,t=t.slice(-1*e.length+n);(r=c.exec(t))!=null;){if(i=r[1]||r[2]||r[3]||r[4]||r[5]||r[6],!i)continue;if(a=[...i].length,r[3]||r[4]){o+=a;continue}else if((r[5]||r[6])&&n%3&&!((n+a)%3)){s+=a;continue}if(o-=a,o>0)continue;a=Math.min(a,a+o+s);let t=[...r[0]][0].length,c=e.slice(0,n+r.index+t+a);if(Math.min(n,a)%2){let e=c.slice(1,-1);return{type:`em`,raw:c,text:e,tokens:this.lexer.inlineTokens(e)}}let l=c.slice(2,-2);return{type:`strong`,raw:c,text:l,tokens:this.lexer.inlineTokens(l)}}}}codespan(e){let t=this.rules.inline.code.exec(e);if(t){let e=t[2].replace(this.rules.other.newLineCharGlobal,` `),n=this.rules.other.nonSpaceChar.test(e),r=this.rules.other.startingSpaceChar.test(e)&&this.rules.other.endingSpaceChar.test(e);return n&&r&&(e=e.substring(1,e.length-1)),{type:`codespan`,raw:t[0],text:e}}}br(e){let t=this.rules.inline.br.exec(e);if(t)return{type:`br`,raw:t[0]}}del(e){let t=this.rules.inline.del.exec(e);if(t)return{type:`del`,raw:t[0],text:t[2],tokens:this.lexer.inlineTokens(t[2])}}autolink(e){let t=this.rules.inline.autolink.exec(e);if(t){let e,n;return t[2]===`@`?(e=t[1],n=`mailto:`+e):(e=t[1],n=e),{type:`link`,raw:t[0],text:e,href:n,tokens:[{type:`text`,raw:e,text:e}]}}}url(e){let t;if(t=this.rules.inline.url.exec(e)){let e,n;if(t[2]===`@`)e=t[0],n=`mailto:`+e;else{let r;do r=t[0],t[0]=this.rules.inline._backpedal.exec(t[0])?.[0]??``;while(r!==t[0]);e=t[0],n=t[1]===`www.`?`http://`+t[0]:t[0]}return{type:`link`,raw:t[0],text:e,href:n,tokens:[{type:`text`,raw:e,text:e}]}}}inlineText(e){let t=this.rules.inline.text.exec(e);if(t){let e=this.lexer.state.inRawBlock;return{type:`text`,raw:t[0],text:t[0],escaped:e}}}},U=class e{tokens;options;state;tokenizer;inlineQueue;constructor(e){this.tokens=[],this.tokens.links=Object.create(null),this.options=e||A,this.options.tokenizer=this.options.tokenizer||new H,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let t={other:N,block:R.normal,inline:z.normal};this.options.pedantic?(t.block=R.pedantic,t.inline=z.pedantic):this.options.gfm&&(t.block=R.gfm,this.options.breaks?t.inline=z.breaks:t.inline=z.gfm),this.tokenizer.rules=t}static get rules(){return{block:R,inline:z}}static lex(t,n){return new e(n).lex(t)}static lexInline(t,n){return new e(n).inlineTokens(t)}lex(e){e=e.replace(N.carriageReturn,`
`),this.blockTokens(e,this.tokens);for(let e=0;e<this.inlineQueue.length;e++){let t=this.inlineQueue[e];this.inlineTokens(t.src,t.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,t=[],n=!1){for(this.options.pedantic&&(e=e.replace(N.tabCharGlobal,`    `).replace(N.spaceLine,``));e;){let r;if(this.options.extensions?.block?.some(n=>(r=n.call({lexer:this},e,t))?(e=e.substring(r.raw.length),t.push(r),!0):!1))continue;if(r=this.tokenizer.space(e)){e=e.substring(r.raw.length);let n=t.at(-1);r.raw.length===1&&n!==void 0?n.raw+=`
`:t.push(r);continue}if(r=this.tokenizer.code(e)){e=e.substring(r.raw.length);let n=t.at(-1);n?.type===`paragraph`||n?.type===`text`?(n.raw+=(n.raw.endsWith(`
`)?``:`
`)+r.raw,n.text+=`
`+r.text,this.inlineQueue.at(-1).src=n.text):t.push(r);continue}if(r=this.tokenizer.fences(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.heading(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.hr(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.blockquote(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.list(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.html(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.def(e)){e=e.substring(r.raw.length);let n=t.at(-1);n?.type===`paragraph`||n?.type===`text`?(n.raw+=(n.raw.endsWith(`
`)?``:`
`)+r.raw,n.text+=`
`+r.raw,this.inlineQueue.at(-1).src=n.text):this.tokens.links[r.tag]||(this.tokens.links[r.tag]={href:r.href,title:r.title},t.push(r));continue}if(r=this.tokenizer.table(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.lheading(e)){e=e.substring(r.raw.length),t.push(r);continue}let i=e;if(this.options.extensions?.startBlock){let t=1/0,n=e.slice(1),r;this.options.extensions.startBlock.forEach(e=>{r=e.call({lexer:this},n),typeof r==`number`&&r>=0&&(t=Math.min(t,r))}),t<1/0&&t>=0&&(i=e.substring(0,t+1))}if(this.state.top&&(r=this.tokenizer.paragraph(i))){let a=t.at(-1);n&&a?.type===`paragraph`?(a.raw+=(a.raw.endsWith(`
`)?``:`
`)+r.raw,a.text+=`
`+r.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=a.text):t.push(r),n=i.length!==e.length,e=e.substring(r.raw.length);continue}if(r=this.tokenizer.text(e)){e=e.substring(r.raw.length);let n=t.at(-1);n?.type===`text`?(n.raw+=(n.raw.endsWith(`
`)?``:`
`)+r.raw,n.text+=`
`+r.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=n.text):t.push(r);continue}if(e){let t=`Infinite loop on byte: `+e.charCodeAt(0);if(this.options.silent){console.error(t);break}else throw Error(t)}}return this.state.top=!0,t}inline(e,t=[]){return this.inlineQueue.push({src:e,tokens:t}),t}inlineTokens(e,t=[]){let n=e,r=null;if(this.tokens.links){let e=Object.keys(this.tokens.links);if(e.length>0)for(;(r=this.tokenizer.rules.inline.reflinkSearch.exec(n))!=null;)e.includes(r[0].slice(r[0].lastIndexOf(`[`)+1,-1))&&(n=n.slice(0,r.index)+`[`+`a`.repeat(r[0].length-2)+`]`+n.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(r=this.tokenizer.rules.inline.anyPunctuation.exec(n))!=null;)n=n.slice(0,r.index)+`++`+n.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let i;for(;(r=this.tokenizer.rules.inline.blockSkip.exec(n))!=null;)i=r[2]?r[2].length:0,n=n.slice(0,r.index+i)+`[`+`a`.repeat(r[0].length-i-2)+`]`+n.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);n=this.options.hooks?.emStrongMask?.call({lexer:this},n)??n;let a=!1,o=``;for(;e;){a||(o=``),a=!1;let r;if(this.options.extensions?.inline?.some(n=>(r=n.call({lexer:this},e,t))?(e=e.substring(r.raw.length),t.push(r),!0):!1))continue;if(r=this.tokenizer.escape(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.tag(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.link(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(r.raw.length);let n=t.at(-1);r.type===`text`&&n?.type===`text`?(n.raw+=r.raw,n.text+=r.text):t.push(r);continue}if(r=this.tokenizer.emStrong(e,n,o)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.codespan(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.br(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.del(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.autolink(e)){e=e.substring(r.raw.length),t.push(r);continue}if(!this.state.inLink&&(r=this.tokenizer.url(e))){e=e.substring(r.raw.length),t.push(r);continue}let i=e;if(this.options.extensions?.startInline){let t=1/0,n=e.slice(1),r;this.options.extensions.startInline.forEach(e=>{r=e.call({lexer:this},n),typeof r==`number`&&r>=0&&(t=Math.min(t,r))}),t<1/0&&t>=0&&(i=e.substring(0,t+1))}if(r=this.tokenizer.inlineText(i)){e=e.substring(r.raw.length),r.raw.slice(-1)!==`_`&&(o=r.raw.slice(-1)),a=!0;let n=t.at(-1);n?.type===`text`?(n.raw+=r.raw,n.text+=r.text):t.push(r);continue}if(e){let t=`Infinite loop on byte: `+e.charCodeAt(0);if(this.options.silent){console.error(t);break}else throw Error(t)}}return t}},W=class{options;parser;constructor(e){this.options=e||A}space(e){return``}code({text:e,lang:t,escaped:n}){let r=(t||``).match(N.notSpaceStart)?.[0],i=e.replace(N.endingNewline,``)+`
`;return r?`<pre><code class="language-`+B(r)+`">`+(n?i:B(i,!0))+`</code></pre>
`:`<pre><code>`+(n?i:B(i,!0))+`</code></pre>
`}blockquote({tokens:e}){return`<blockquote>
${this.parser.parse(e)}</blockquote>
`}html({text:e}){return e}def(e){return``}heading({tokens:e,depth:t}){return`<h${t}>${this.parser.parseInline(e)}</h${t}>
`}hr(e){return`<hr>
`}list(e){let t=e.ordered,n=e.start,r=``;for(let t=0;t<e.items.length;t++){let n=e.items[t];r+=this.listitem(n)}let i=t?`ol`:`ul`,a=t&&n!==1?` start="`+n+`"`:``;return`<`+i+a+`>
`+r+`</`+i+`>
`}listitem(e){let t=``;if(e.task){let n=this.checkbox({checked:!!e.checked});e.loose?e.tokens[0]?.type===`paragraph`?(e.tokens[0].text=n+` `+e.tokens[0].text,e.tokens[0].tokens&&e.tokens[0].tokens.length>0&&e.tokens[0].tokens[0].type===`text`&&(e.tokens[0].tokens[0].text=n+` `+B(e.tokens[0].tokens[0].text),e.tokens[0].tokens[0].escaped=!0)):e.tokens.unshift({type:`text`,raw:n+` `,text:n+` `,escaped:!0}):t+=n+` `}return t+=this.parser.parse(e.tokens,!!e.loose),`<li>${t}</li>
`}checkbox({checked:e}){return`<input `+(e?`checked="" `:``)+`disabled="" type="checkbox">`}paragraph({tokens:e}){return`<p>${this.parser.parseInline(e)}</p>
`}table(e){let t=``,n=``;for(let t=0;t<e.header.length;t++)n+=this.tablecell(e.header[t]);t+=this.tablerow({text:n});let r=``;for(let t=0;t<e.rows.length;t++){let i=e.rows[t];n=``;for(let e=0;e<i.length;e++)n+=this.tablecell(i[e]);r+=this.tablerow({text:n})}return r&&=`<tbody>${r}</tbody>`,`<table>
<thead>
`+t+`</thead>
`+r+`</table>
`}tablerow({text:e}){return`<tr>
${e}</tr>
`}tablecell(e){let t=this.parser.parseInline(e.tokens),n=e.header?`th`:`td`;return(e.align?`<${n} align="${e.align}">`:`<${n}>`)+t+`</${n}>
`}strong({tokens:e}){return`<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return`<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return`<code>${B(e,!0)}</code>`}br(e){return`<br>`}del({tokens:e}){return`<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:n}){let r=this.parser.parseInline(n),i=hn(e);if(i===null)return r;e=i;let a=`<a href="`+e+`"`;return t&&(a+=` title="`+B(t)+`"`),a+=`>`+r+`</a>`,a}image({href:e,title:t,text:n,tokens:r}){r&&(n=this.parser.parseInline(r,this.parser.textRenderer));let i=hn(e);if(i===null)return B(n);e=i;let a=`<img src="${e}" alt="${n}"`;return t&&(a+=` title="${B(t)}"`),a+=`>`,a}text(e){return`tokens`in e&&e.tokens?this.parser.parseInline(e.tokens):`escaped`in e&&e.escaped?e.text:B(e.text)}},bn=class{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return``+e}image({text:e}){return``+e}br(){return``}},G=class e{options;renderer;textRenderer;constructor(e){this.options=e||A,this.options.renderer=this.options.renderer||new W,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new bn}static parse(t,n){return new e(n).parse(t)}static parseInline(t,n){return new e(n).parseInline(t)}parse(e,t=!0){let n=``;for(let r=0;r<e.length;r++){let i=e[r];if(this.options.extensions?.renderers?.[i.type]){let e=i,t=this.options.extensions.renderers[e.type].call({parser:this},e);if(t!==!1||![`space`,`hr`,`heading`,`code`,`table`,`blockquote`,`list`,`html`,`def`,`paragraph`,`text`].includes(e.type)){n+=t||``;continue}}let a=i;switch(a.type){case`space`:n+=this.renderer.space(a);continue;case`hr`:n+=this.renderer.hr(a);continue;case`heading`:n+=this.renderer.heading(a);continue;case`code`:n+=this.renderer.code(a);continue;case`table`:n+=this.renderer.table(a);continue;case`blockquote`:n+=this.renderer.blockquote(a);continue;case`list`:n+=this.renderer.list(a);continue;case`html`:n+=this.renderer.html(a);continue;case`def`:n+=this.renderer.def(a);continue;case`paragraph`:n+=this.renderer.paragraph(a);continue;case`text`:{let i=a,o=this.renderer.text(i);for(;r+1<e.length&&e[r+1].type===`text`;)i=e[++r],o+=`
`+this.renderer.text(i);t?n+=this.renderer.paragraph({type:`paragraph`,raw:o,text:o,tokens:[{type:`text`,raw:o,text:o,escaped:!0}]}):n+=o;continue}default:{let e=`Token with "`+a.type+`" type was not found.`;if(this.options.silent)return console.error(e),``;throw Error(e)}}}return n}parseInline(e,t=this.renderer){let n=``;for(let r=0;r<e.length;r++){let i=e[r];if(this.options.extensions?.renderers?.[i.type]){let e=this.options.extensions.renderers[i.type].call({parser:this},i);if(e!==!1||![`escape`,`html`,`link`,`image`,`strong`,`em`,`codespan`,`br`,`del`,`text`].includes(i.type)){n+=e||``;continue}}let a=i;switch(a.type){case`escape`:n+=t.text(a);break;case`html`:n+=t.html(a);break;case`link`:n+=t.link(a);break;case`image`:n+=t.image(a);break;case`strong`:n+=t.strong(a);break;case`em`:n+=t.em(a);break;case`codespan`:n+=t.codespan(a);break;case`br`:n+=t.br(a);break;case`del`:n+=t.del(a);break;case`text`:n+=t.text(a);break;default:{let e=`Token with "`+a.type+`" type was not found.`;if(this.options.silent)return console.error(e),``;throw Error(e)}}}return n}},K=class{options;block;constructor(e){this.options=e||A}static passThroughHooks=new Set([`preprocess`,`postprocess`,`processAllTokens`,`emStrongMask`]);static passThroughHooksRespectAsync=new Set([`preprocess`,`postprocess`,`processAllTokens`]);preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}emStrongMask(e){return e}provideLexer(){return this.block?U.lex:U.lexInline}provideParser(){return this.block?G.parse:G.parseInline}},q=new class{defaults=ft();options=this.setOptions;parse=this.parseMarkdown(!0);parseInline=this.parseMarkdown(!1);Parser=G;Renderer=W;TextRenderer=bn;Lexer=U;Tokenizer=H;Hooks=K;constructor(...e){this.use(...e)}walkTokens(e,t){let n=[];for(let r of e)switch(n=n.concat(t.call(this,r)),r.type){case`table`:{let e=r;for(let r of e.header)n=n.concat(this.walkTokens(r.tokens,t));for(let r of e.rows)for(let e of r)n=n.concat(this.walkTokens(e.tokens,t));break}case`list`:{let e=r;n=n.concat(this.walkTokens(e.items,t));break}default:{let e=r;this.defaults.extensions?.childTokens?.[e.type]?this.defaults.extensions.childTokens[e.type].forEach(r=>{let i=e[r].flat(1/0);n=n.concat(this.walkTokens(i,t))}):e.tokens&&(n=n.concat(this.walkTokens(e.tokens,t)))}}return n}use(...e){let t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(e=>{let n={...e};if(n.async=this.defaults.async||n.async||!1,e.extensions&&(e.extensions.forEach(e=>{if(!e.name)throw Error(`extension name required`);if(`renderer`in e){let n=t.renderers[e.name];n?t.renderers[e.name]=function(...t){let r=e.renderer.apply(this,t);return r===!1&&(r=n.apply(this,t)),r}:t.renderers[e.name]=e.renderer}if(`tokenizer`in e){if(!e.level||e.level!==`block`&&e.level!==`inline`)throw Error(`extension level must be 'block' or 'inline'`);let n=t[e.level];n?n.unshift(e.tokenizer):t[e.level]=[e.tokenizer],e.start&&(e.level===`block`?t.startBlock?t.startBlock.push(e.start):t.startBlock=[e.start]:e.level===`inline`&&(t.startInline?t.startInline.push(e.start):t.startInline=[e.start]))}`childTokens`in e&&e.childTokens&&(t.childTokens[e.name]=e.childTokens)}),n.extensions=t),e.renderer){let t=this.defaults.renderer||new W(this.defaults);for(let n in e.renderer){if(!(n in t))throw Error(`renderer '${n}' does not exist`);if([`options`,`parser`].includes(n))continue;let r=n,i=e.renderer[r],a=t[r];t[r]=(...e)=>{let n=i.apply(t,e);return n===!1&&(n=a.apply(t,e)),n||``}}n.renderer=t}if(e.tokenizer){let t=this.defaults.tokenizer||new H(this.defaults);for(let n in e.tokenizer){if(!(n in t))throw Error(`tokenizer '${n}' does not exist`);if([`options`,`rules`,`lexer`].includes(n))continue;let r=n,i=e.tokenizer[r],a=t[r];t[r]=(...e)=>{let n=i.apply(t,e);return n===!1&&(n=a.apply(t,e)),n}}n.tokenizer=t}if(e.hooks){let t=this.defaults.hooks||new K;for(let n in e.hooks){if(!(n in t))throw Error(`hook '${n}' does not exist`);if([`options`,`block`].includes(n))continue;let r=n,i=e.hooks[r],a=t[r];K.passThroughHooks.has(n)?t[r]=e=>{if(this.defaults.async&&K.passThroughHooksRespectAsync.has(n))return(async()=>{let n=await i.call(t,e);return a.call(t,n)})();let r=i.call(t,e);return a.call(t,r)}:t[r]=(...e)=>{if(this.defaults.async)return(async()=>{let n=await i.apply(t,e);return n===!1&&(n=await a.apply(t,e)),n})();let n=i.apply(t,e);return n===!1&&(n=a.apply(t,e)),n}}n.hooks=t}if(e.walkTokens){let t=this.defaults.walkTokens,r=e.walkTokens;n.walkTokens=function(e){let n=[];return n.push(r.call(this,e)),t&&(n=n.concat(t.call(this,e))),n}}this.defaults={...this.defaults,...n}}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return U.lex(e,t??this.defaults)}parser(e,t){return G.parse(e,t??this.defaults)}parseMarkdown(e){return(t,n)=>{let r={...n},i={...this.defaults,...r},a=this.onError(!!i.silent,!!i.async);if(this.defaults.async===!0&&r.async===!1)return a(Error(`marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise.`));if(typeof t>`u`||t===null)return a(Error(`marked(): input parameter is undefined or null`));if(typeof t!=`string`)return a(Error(`marked(): input parameter is of type `+Object.prototype.toString.call(t)+`, string expected`));if(i.hooks&&(i.hooks.options=i,i.hooks.block=e),i.async)return(async()=>{let n=i.hooks?await i.hooks.preprocess(t):t,r=await(i.hooks?await i.hooks.provideLexer():e?U.lex:U.lexInline)(n,i),a=i.hooks?await i.hooks.processAllTokens(r):r;i.walkTokens&&await Promise.all(this.walkTokens(a,i.walkTokens));let o=await(i.hooks?await i.hooks.provideParser():e?G.parse:G.parseInline)(a,i);return i.hooks?await i.hooks.postprocess(o):o})().catch(a);try{i.hooks&&(t=i.hooks.preprocess(t));let n=(i.hooks?i.hooks.provideLexer():e?U.lex:U.lexInline)(t,i);i.hooks&&(n=i.hooks.processAllTokens(n)),i.walkTokens&&this.walkTokens(n,i.walkTokens);let r=(i.hooks?i.hooks.provideParser():e?G.parse:G.parseInline)(n,i);return i.hooks&&(r=i.hooks.postprocess(r)),r}catch(e){return a(e)}}}onError(e,t){return n=>{if(n.message+=`
Please report this to https://github.com/markedjs/marked.`,e){let e=`<p>An error occurred:</p><pre>`+B(n.message+``,!0)+`</pre>`;return t?Promise.resolve(e):e}if(t)return Promise.reject(n);throw n}}};function J(e,t){return q.parse(e,t)}J.options=J.setOptions=function(e){return q.setOptions(e),J.defaults=q.defaults,pt(J.defaults),J},J.getDefaults=ft,J.defaults=A,J.use=function(...e){return q.use(...e),J.defaults=q.defaults,pt(J.defaults),J},J.walkTokens=function(e,t){return q.walkTokens(e,t)},J.parseInline=q.parseInline,J.Parser=G,J.parser=G.parse,J.Renderer=W,J.TextRenderer=bn,J.Lexer=U,J.lexer=U.lex,J.Tokenizer=H,J.Hooks=K,J.parse=J,J.options,J.setOptions,J.use,J.walkTokens,J.parseInline,G.parse,U.lex;var xn=`You are an assistant in a web application with workspace, editors, and AI chat.

**Tools:**
Commands are exposed as AI-callable tools. Tools are context-aware - available commands depend on active editor, selected files, and workspace state.

**Tool Usage Rules:**
1. If tools are available and match the request, use them - don't describe manual steps
2. Read tool descriptions/parameters to select the correct tool
3. Call tools in sequence for multi-step tasks
4. After successful tool execution, provide a final response - don't loop or call more tools unless explicitly requested
5. If no tools are available, explain what context is needed

Keep responses concise. Use tools when available rather than discussing alternatives.

`;for(let{label:e,...t}of[{label:`Ollama (Local)`,name:`ollama`,model:`gemma3:12b`,chatApiEndpoint:`https://<your-server>/v1/chat/completions`,apiKey:``},{label:`OpenWebUI (Self Hosted)`,name:`openwebui`,model:`gemma3:12b`,chatApiEndpoint:`https://<your-server>/api/v1/chat/completion`,apiKey:``},{label:`OpenAI`,name:`openai`,model:`gpt-4.1`,chatApiEndpoint:`https://api.openai.com/v1/chat/completions`,apiKey:`<your api key>`},{label:`Groq`,name:`groq`,model:`llama-3.1-8b-instant`,chatApiEndpoint:`https://api.groq.com/openai/v1/chat/completions`,apiKey:`<your api key>`},{label:`Cerebras`,name:`cerebras`,model:`llama3.1-8b`,chatApiEndpoint:`https://api.cerebras.ai/v1/chat/completions`,apiKey:`<your api key>`},{label:`WebLLM`,name:`webllm`,model:`gemma-2-9b-it-q4f16_1-MLC`,chatApiEndpoint:``,apiKey:``,parameters:{context_window_size:4096}},{label:`Mistral`,name:`mistral`,model:`mistral-large-latest`,chatApiEndpoint:`https://api.mistral.ai/v1/chat/completions`,apiKey:`<your api key>`},{label:`LiteLLM`,name:`litellm`,model:`gpt-3.5-turbo`,chatApiEndpoint:`https://<your-server>/v1/chat/completions`,apiKey:`<your api key>`}])n.registerContribution(C,{target:C,label:e,provider:t});n.registerContribution(ye,{label:`App State Enhancer`,enhancer:{priority:20,enhance:async(e,t)=>{try{let t=await se.getWorkspace(),n=te.getEditorArea()?.getActiveEditor(),r={workspace:t?.getName()||null,activeEditor:n?{title:n.input?.title||null,editorId:n.input?.editorId||null}:null};return`${e}\n\n***App's state:***\n${JSON.stringify(r,null,2)}`}catch{return e}}}});var Sn=class{constructor(){this.activeSession=null,this.pastSessions=[]}async load(){let e=await h.get(`aiChatSessions`);if(e){if(e.active&&Array.isArray(e.history))this.activeSession=e.active;else if(e.activeSessionId&&Array.isArray(e.sessions))this.activeSession=e.sessions.find(t=>t.id===e.activeSessionId)||null,this.pastSessions=e.sessions.filter(t=>t.id!==e.activeSessionId);else if(Array.isArray(e.all)){let[t,...n]=e.all.sort((e,t)=>t.updatedAt-e.updatedAt);this.activeSession=t||null,this.pastSessions=n}}}async persist(){let e=[];this.activeSession&&e.push(this.activeSession),e.push(...this.pastSessions),await h.set(`aiChatSessions`,{all:e,activeSessionId:this.activeSession?.id||null})}createSession(){let e={id:`session-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,history:[],title:`New Chat`,createdAt:Date.now(),updatedAt:Date.now()};return this.activeSession&&this.pastSessions.unshift(this.activeSession),this.activeSession=e,this.persist(),e}getActiveSession(){return this.activeSession}getActiveSessionId(){return this.activeSession?.id||``}switchToSession(e){if(this.activeSession?.id===e)return!0;let t=this.pastSessions.findIndex(t=>t.id===e);if(t===-1)return!1;let[n]=this.pastSessions.splice(t,1);return n?(this.activeSession&&this.pastSessions.unshift(this.activeSession),this.activeSession=n,this.persist(),!0):!1}getPastSessions(){return this.pastSessions}deletePastSession(e){let t=this.pastSessions.findIndex(t=>t.id===e);return t===-1?!1:(this.pastSessions.splice(t,1),this.persist(),!0)}addMessage(e){this.activeSession&&(this.activeSession.history.push(e),this.activeSession.updatedAt=Date.now(),this.persist())}setTitle(e){this.activeSession&&(this.activeSession.title=e,this.persist())}generateTitle(e){let t=e.trim();return t?t.length<=30?t:t.substring(0,30).trim()+`...`:`New Chat`}deleteActiveAndSwitchToFirst(){this.activeSession&&(this.activeSession=this.pastSessions.shift()||null,this.activeSession||this.createSession(),this.persist())}},Cn=class{constructor(e){this.streamingMessages=new Map,this.currentIndex=-1,this.pendingUpdate=!1,this.onUpdate=e}createStreamingMessage(e){let t=++this.currentIndex;return this.streamingMessages.set(t,{message:{role:e,content:``},isStreaming:!0}),t}updateStreamingMessage(e,t){let n=this.streamingMessages.get(e);n&&(n.message.content+=t,this.scheduleUpdate())}completeStreamingMessage(e,t){let n=this.streamingMessages.get(e);n&&(n.message=t,n.isStreaming=!1)}removeStreamingMessage(e){this.streamingMessages.delete(e)}findStreamingMessage(e){return Array.from(this.streamingMessages.values()).find(t=>t.message.role===e)?.message}getAllStreamingMessages(){return Array.from(this.streamingMessages.values())}scheduleUpdate(){this.pendingUpdate||(this.pendingUpdate=!0,this.rafHandle=requestAnimationFrame(()=>{this.pendingUpdate=!1,this.onUpdate?.()}))}cancelUpdates(){this.rafHandle!==void 0&&(cancelAnimationFrame(this.rafHandle),this.rafHandle=void 0,this.pendingUpdate=!1)}reset(){this.streamingMessages.clear(),this.cancelUpdates(),this.currentIndex=-1}},wn=`aiViewChat`,Tn=class{constructor(e){this.aiService=e,this.providers=[],this.availableModels=[],this.loadingModels=!1,this.providerFactory=new T}async initialize(){this.providers=await this.aiService.getProviders()||[];let e=await this.aiService.getDefaultProvider();e&&(this.selectedProvider=e)}getProviders(){return this.providers}getSelectedProvider(){return this.selectedProvider}setSelectedProvider(e){this.selectedProvider=e}getAvailableModels(){return this.availableModels}isLoadingModels(){return this.loadingModels}async saveSettings(e,t,n,r,i){let a={...await h.get(wn)||{}};r!==void 0&&(a.requireToolApproval=r),i!==void 0&&(a.toolApprovalAllowlist=i),await h.set(wn,a);let o=this.providers.find(t=>t.name===e);o&&(this.selectedProvider={...o,model:t,...n!==void 0&&{apiKey:n}},await this.updateProviderInAIConfig(e,{model:t,...n!==void 0&&{apiKey:n}}),await this.aiService.setDefaultProvider(e))}async updateProviderInAIConfig(e,t){let n=await h.get(`aiConfig`)||{};if(!n.providers||!Array.isArray(n.providers))return;let r=n.providers.findIndex(t=>t.name===e);r>=0&&(n.providers[r]={...n.providers[r],...t},await h.set(w,n))}async loadToolApprovalAllowlist(){return(await h.get(wn)||{}).toolApprovalAllowlist||[]}async fetchModels(e){let t=this.providers.find(t=>t.name===e);if(t){this.loadingModels=!0,this.availableModels=[];try{this.availableModels=await this.providerFactory.getProvider(t).getAvailableModels?.(t)??[]}finally{this.loadingModels=!1}}}},En=class{constructor(){this.groups=new Map}createGroup(e,t,n,r,i){let a=`group-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;this.currentGroupId=a;let o={id:a,sessionId:e,userMessageIndex:t,userMessage:n,timestamp:new Date,agents:new Map,messageIndices:new Map};return r.forEach(e=>{let{label:t,icon:n}=i(e);o.agents.set(e,{role:e,label:t,icon:n,status:`streaming`})}),this.groups.set(a,o),a}getGroup(e){return this.groups.get(e)}updateAgentStatus(e,t,n,r,i){let a=this.groups.get(e);if(!a)return;let o=a.agents.get(t);o&&(o.status=n,r&&(o.message=r),i!==void 0&&(o.messageIndex=i,a.messageIndices.set(t,i)))}getGroupsForSession(e){return Array.from(this.groups.values()).filter(t=>t.sessionId===e)}findGroupForUserMessage(e,t,n){return Array.from(this.groups.values()).find(r=>r.sessionId===e&&r.userMessageIndex===t&&r.userMessage===n)}findGroupForMessage(e,t,n){return Array.from(this.groups.values()).find(r=>r.sessionId===e&&r.messageIndices.get(t)===n)}getCurrentGroupId(){return this.currentGroupId}setCurrentGroupId(e){this.currentGroupId=e}clearCurrentGroup(){this.currentGroupId=void 0}getAllGroups(){return Array.from(this.groups.values())}clearAll(){this.groups.clear(),this.currentGroupId=void 0}},Y=class extends _{constructor(...e){super(...e),this.isStreaming=!1,this.showHeader=!0}updated(e){super.updated(e),(e.has(`message`)||!this.hasAttribute(`data-is-user`))&&this.updateAlignment()}updateAlignment(){this.message&&this.setAttribute(`data-is-user`,String(this.message.role===`user`))}copyToClipboard(e){navigator.clipboard.writeText(e).catch(e=>console.error(`Failed to copy:`,e))}processMarkdownContent(e){return e.includes(`code-blocwrapper`)?e:e.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/gi,(e,t,n)=>`
            <div class="code-blocwrapper">
                <div class="code-blocheader">
                    <wa-copy-button value="${this.escapeHtmlAttribute(n.trim())}" size="small" label="Copy code"></wa-copy-button>
                </div>
                <div class="code-bloccontent">
                    <pre><code${t}>${n}</code></pre>
                </div>
            </div>`)}escapeHtmlAttribute(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}handleResend(e){e?.preventDefault(),e?.stopPropagation(),this.message&&this.dispatchEvent(new CustomEvent(`resend`,{detail:{message:this.message,messageIndex:this.messageIndex},bubbles:!0,composed:!0}))}render(){if(!this.message)return v``;let t=this.message,n=t.role===`user`;return v`
            <div class="message-wrapper ${n?`user`:`assistant`} ${this.isStreaming?`streaming`:``}">
                ${g(this.showHeader&&!n,()=>v`
                    <div class="message-header">
                        <div class="message-meta">
                            <wa-icon name="robot" label="${t.role}"></wa-icon>
                            <span class="role-name">${t.role}</span>
                        </div>
                    <div class="message-actions">
                        <wa-button variant="neutral" appearance="plain" size="small" title="Copy"
                            @click="${()=>this.copyToClipboard(t.content)}">
                            <wa-icon slot="label" name="copy" label="Copy"></wa-icon>
                        </wa-button>
                    </div>
                    </div>
                `)}
                <div class="message-content-wrapper ${n?`user`:``}">
                    <div class="message-content">
                        ${e(this.processMarkdownContent(J.parse(t.content||``)))}
                        ${g(this.isStreaming,()=>v`<span class="streaming-cursor">▋</span>`)}
                    </div>
                    ${g(n,()=>v`
                        <wa-button variant="neutral" appearance="plain" size="small" title="Copy"
                            @click="${()=>this.copyToClipboard(t.content)}">
                            <wa-icon name="copy" label="Copy"></wa-icon>
                        </wa-button>
                        <wa-button variant="neutral" appearance="plain" size="small" title="Resend"
                            @click="${e=>this.handleResend(e)}">
                            <wa-icon name="rotate-right" label="Resend"></wa-icon>
                        </wa-button>
                    `)}
                </div>
            </div>
        `}static{this.styles=y`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 85%;
            box-sizing: border-box;
            animation: slideIn 0.2s ease-out;
        }

        :host([data-is-user="true"]) { align-self: flex-end; }
        :host([data-is-user="false"]) { align-self: flex-start; }

        @keyframes slideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message-wrapper {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            width: 100%;
            box-sizing: border-box;
        }

        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 0.5rem;
            padding: 0 0.5rem;
        }

        .message-meta {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            color: var(--wa-color-text-quiet);
        }

        .role-name { text-transform: capitalize; }

        .message-actions {
            display: flex;
            gap: 0.25rem;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .message-wrapper:hover .message-actions,
        :host:hover .message-actions { opacity: 1; }

        .message-content-wrapper {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            width: 100%;
        }

        .message-content-wrapper.user {
            flex-direction: row;
            align-items: center;
        }

        .message-content {
            padding: 0.5rem 0.75rem;
            border-radius: 0.25rem;
            background-color: var(--wa-color-surface-default);
            word-break: breaword;
            overflow-wrap: breaword;
            max-width: 100%;
            box-sizing: border-box;
            line-height: 1.3;
            font-size: 0.9rem;
        }

        .message-content-wrapper.user .message-content {
            padding: 0.0625rem 0.75rem;
            background-color: var(--wa-color-brand-fill-quiet);
            color: var(--wa-color-text-normal);
            line-height: 1.4;
            flex: 1;
        }

        .message-content p { margin: 0; padding: 0; }
        .message-content ul, .message-content ol { margin: 0.25rem 0; padding-left: 1.25rem; }
        .message-content li { margin: 0.125rem 0; padding: 0; line-height: 1.3; }
        .message-content :first-child { margin-top: 0; padding-top: 0; }
        .message-content :last-child { margin-bottom: 0; padding-bottom: 0; }

        .message-content pre {
            white-space: pre-wrap;
            word-break: breaall;
            max-width: 100%;
            box-sizing: border-box;
            overflow-x: auto;
            margin: 0;
        }

        .message-content code {
            font-family: 'Courier New', monospace;
            background-color: var(--wa-color-surface-lowered);
            padding: 0.125rem 0.25rem;
            border-radius: 0.125rem;
        }

        .message-content pre code { background-color: transparent; padding: 0; display: block; }

        .code-blocwrapper {
            margin: 0.75rem 0;
            border: solid var(--wa-border-width-s) var(--wa-color-neutral-border-loud);
            border-radius: var(--wa-border-radius-m);
            background-color: var(--wa-color-surface-lowered);
            overflow: hidden;
        }

        .code-blocheader {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding: 0.375rem 0.5rem;
            border-bottom: solid var(--wa-border-width-s) var(--wa-color-neutral-border-loud);
            background-color: var(--wa-color-surface-default);
        }

        .code-bloccontent { padding: 0.75rem; overflow-x: auto; }
        .code-bloccontent pre { margin: 0; background-color: transparent; }
        .code-bloccontent code { background-color: transparent; padding: 0; }

        .streaming-cursor {
            display: inline-block;
            animation: blink 1s infinite;
            color: var(--wa-color-brand-50);
        }

        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }
    `}};a([o({type:Object,attribute:!1})],Y.prototype,`message`,void 0),a([o({type:Boolean})],Y.prototype,`isStreaming`,void 0),a([o({type:Boolean})],Y.prototype,`showHeader`,void 0),a([o({type:Number,attribute:!1})],Y.prototype,`messageIndex`,void 0),Y=a([t(`docks-ai-chat-message`)],Y);var X=class extends _{constructor(...e){super(...e),this.value=``,this.disabled=!1,this.busy=!1,this.hasProvider=!0}onInput(e){this.value=e.target.value,this.dispatchEvent(new CustomEvent(`input-change`,{detail:{value:this.value},bubbles:!0,composed:!0}))}onKeyDown(e){e.key===`Enter`&&!e.shiftKey&&(e.preventDefault(),this.send())}async send(){if(!this.value.trim()||this.disabled||!this.hasProvider)return;let e=this.value;this.value=``,this.requestUpdate(),await this.updateComplete,this.textareaElement&&(this.textareaElement.value=``,this.textareaElement.focus()),this.dispatchEvent(new CustomEvent(`send`,{detail:{value:e},bubbles:!0,composed:!0}))}cancel(){this.dispatchEvent(new CustomEvent(`cancel`,{bubbles:!0,composed:!0}))}render(){return v`
            <div class="input-container">
                <div class="input-row">
                    <wa-textarea
                        placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                        size="small"
                        resize="auto"
                        rows="1"
                        .value="${this.value}"
                        ?disabled="${this.disabled||!this.hasProvider}"
                        @input="${this.onInput}"
                        @keydown="${this.onKeyDown}">
                    </wa-textarea>
                    ${g(this.busy,()=>v`
                        <wa-button appearance="plain" size="small" @click="${this.cancel}">
                            <wa-icon name="stop" label="Stop"></wa-icon>
                        </wa-button>
                    `)}
                </div>
            </div>
        `}static{this.styles=y`
        :host { display: block; width: 100%; }
        .input-container { margin-bottom: 0.25rem; margin-left: 0.25rem; }
        .input-row { display: flex; gap: 0.5rem; align-items: flex-end; }
        wa-textarea { flex: 1; min-width: 0; }
    `}};a([o({type:String})],X.prototype,`value`,void 0),a([o({type:Boolean})],X.prototype,`disabled`,void 0),a([o({type:Boolean})],X.prototype,`busy`,void 0),a([o({type:Boolean})],X.prototype,`hasProvider`,void 0),a([r(`wa-textarea`)],X.prototype,`textareaElement`,void 0),X=a([t(`docks-ai-chat-input`)],X);var Dn=class extends _{copyToClipboard(e){navigator.clipboard.writeText(e).catch(e=>console.error(`Failed to copy:`,e))}renderStatusIcon(e){switch(e){case`streaming`:return v`<wa-icon name="spinner" class="spinning"></wa-icon>`;case`completed`:return v`<wa-icon name="check-circle" class="status-success"></wa-icon>`;case`error`:return v`<wa-icon name="exclamation-circle" class="status-error"></wa-icon>`}}renderCard(e,t){return t?v`
            <div class="agent-card status-${e.status}">
                <div class="agent-card-header">
                    <wa-icon name="${e.icon}" label="${e.label}"></wa-icon>
                    <span>${e.label}</span>
                    ${this.renderStatusIcon(e.status)}
                    <div class="agent-card-actions">
                        <wa-button variant="neutral" appearance="plain" size="small" title="Copy"
                            @click="${()=>this.copyToClipboard(t.content||``)}">
                            <wa-icon name="copy" label="Copy"></wa-icon>
                        </wa-button>
                    </div>
                </div>
                <div class="agent-card-content">
                    <docks-ai-chat-message
                        .message="${t}"
                        .isStreaming="${e.status===`streaming`}"
                        .showHeader="${!1}"
                        .messageIndex="${e.messageIndex}">
                    </docks-ai-chat-message>
                </div>
            </div>
        `:v`
                <div class="agent-card status-${e.status}">
                    <div class="agent-card-header">
                        <wa-icon name="${e.icon}" label="${e.label}"></wa-icon>
                        <span>${e.label}</span>
                        ${this.renderStatusIcon(e.status)}
                    </div>
                    <div class="agent-card-content waiting">Waiting for response...</div>
                </div>
            `}render(){if(!this.group)return v``;let e=Array.from(this.group.agents.values()),t=e.filter(e=>e.status===`completed`).length,n=e.filter(e=>e.status===`streaming`).length,r=e.filter(e=>e.status===`error`).length,i=e.length>0&&t+r===e.length;return v`
            <div class="agent-response-group">
                ${g(e.length!==1,()=>v`
                    <div class="group-header">
                        <wa-icon name="robot" label="Multiple Agents"></wa-icon>
                        <span>Multiple Agents</span>
                        <span class="status-badge">
                            ${g(n>0,()=>v`<span class="streaming">${n} responding</span>`)}
                            ${g(i,()=>v`<span class="done">All completed (${t})</span>`)}
                        </span>
                    </div>
                `)}
                <div class="group-content">
                    ${s(e,e=>e.role,e=>{let t=e.message||(e.status===`streaming`&&this.findStreamingMessage?this.findStreamingMessage(e.role):void 0);return this.renderCard(e,t)})}
                </div>
            </div>
        `}static{this.styles=y`
        :host { display: block; width: 100%; box-sizing: border-box; }

        .agent-response-group {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            width: 100%;
        }

        .group-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            background-color: var(--wa-color-surface-lowered);
            border: solid var(--wa-border-width-s) var(--wa-color-surface-border);
            font-weight: 500;
        }

        .status-badge {
            display: flex;
            gap: 0.5rem;
            margin-left: auto;
            font-size: 0.875rem;
        }

        .streaming { color: var(--wa-color-brand-50); }
        .done { color: var(--wa-color-success-70); font-weight: 600; }

        .group-content {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            width: 100%;
        }

        .agent-card {
            display: flex;
            flex-direction: column;
            border: solid var(--wa-border-width-s) var(--wa-color-surface-border);
            background-color: var(--wa-color-surface-default);
        }

        .agent-card.status-streaming { border-color: var(--wa-color-brand-border-quiet); }
        .agent-card.status-completed { border-color: var(--wa-color-success-border-quiet); }
        .agent-card.status-error { border-color: var(--wa-color-danger-border-quiet); }

        .agent-card-header {
            display: flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.375rem 0.5rem;
            border-bottom: solid var(--wa-border-width-s) var(--wa-color-surface-border);
            background-color: var(--wa-color-surface-lowered);
            font-weight: 500;
            font-size: 0.875rem;
        }

        .agent-card-actions { margin-left: auto; display: flex; gap: 0.25rem; }
        .agent-card-content { padding: 0.375rem; }
        .waiting { padding: 1rem; text-align: center; color: var(--wa-color-text-quiet); }

        .spinning { animation: spin 1s linear infinite; }
        .status-success { color: var(--wa-color-success-60); }
        .status-error { color: var(--wa-color-danger-60); }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `}};a([o({type:Object,attribute:!1})],Dn.prototype,`group`,void 0),a([o({type:Function,attribute:!1})],Dn.prototype,`findStreamingMessage`,void 0),Dn=a([t(`docks-ai-agent-response-group`)],Dn);var On=class extends _{constructor(...e){super(...e),this.pendingApprovals=new Map}approve(e,t){this.dispatchEvent(new CustomEvent(`approve`,{detail:{approvalId:e,approval:t},bubbles:!0,composed:!0})),t.resolve(!0),this.pendingApprovals.delete(e),this.requestUpdate()}deny(e,t){t.resolve(!1),this.pendingApprovals.delete(e),this.requestUpdate()}formatArgs(e){let t={};try{t=JSON.parse(e)}catch{}return Object.entries(t).map(([e,t])=>`${e}=${JSON.stringify(t)}`).join(`, `)}render(){return this.pendingApprovals.size===0?v``:v`
            <div class="approval-container">
                ${Array.from(this.pendingApprovals.entries()).map(([e,t])=>{let n=t.request.toolCalls,r=n[0];return v`
                        <wa-details class="approval-item">
                            <span slot="summary" class="approval-summary">
                                <span>${n.length===1?`AI wants to execute: ${r?.function.name}()`:`AI wants to execute ${n.length} tools`}</span>
                                <div class="approval-inline-actions">
                                    <wa-button appearance="plain" size="small" variant="neutral"
                                        @click="${n=>{n.stopPropagation(),this.deny(e,t)}}">
                                        <wa-icon name="xmark" label="Deny"></wa-icon>
                                    </wa-button>
                                    <wa-button appearance="plain" size="small" variant="success"
                                        @click="${async n=>{n.stopPropagation(),this.approve(e,t)}}">
                                        <wa-icon name="check" label="Approve"></wa-icon>
                                    </wa-button>
                                </div>
                            </span>
                            <div class="approval-detail">
                                <strong>${t.role} wants to execute:</strong>
                                <ul class="tool-list">
                                    ${s(n,e=>e.id,e=>{let n=this.formatArgs(e.function.arguments||`{}`);return v`
                                            <li class="tool-item">
                                                <label class="always-allow-label">
                                                    <wa-checkbox
                                                        ?checked="${t.alwaysAllowSelections.get(e.id)||!1}"
                                                        @change="${n=>{t.alwaysAllowSelections.set(e.id,n.target.checked),this.requestUpdate()}}">
                                                    </wa-checkbox>
                                                    <span>Always allow</span>
                                                </label>
                                                <code>${e.function.name}(${n})</code>
                                            </li>
                                        `})}
                                </ul>
                            </div>
                        </wa-details>
                    `})}
            </div>
        `}static{this.styles=y`
        :host { display: block; }

        .approval-container {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            border-top: solid var(--wa-border-width-s) var(--wa-color-warning-border-normal);
            background-color: var(--wa-color-warning-fill-quiet);
        }

        .approval-summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            width: 100%;
        }

        .approval-inline-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

        .approval-detail {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            padding: 0.75rem 0;
            font-size: 0.875rem;
        }

        .tool-list { margin: 0.5rem 0 0 1.5rem; padding: 0; list-style: disc; }

        .tool-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0.5rem 0;
        }

        .always-allow-label {
            display: flex;
            align-items: center;
            gap: 0.375rem;
            cursor: pointer;
        }

        code {
            font-family: var(--wa-font-mono);
            font-size: 0.875rem;
            padding: 0.125rem 0.25rem;
            background-color: var(--wa-color-neutral-fill-subtle);
            border-radius: var(--wa-border-radius-s);
        }
    `}};a([o({type:Map,attribute:!1})],On.prototype,`pendingApprovals`,void 0),On=a([t(`docks-ai-tool-approval`)],On);var kn=class extends _{constructor(...e){super(...e),this.message=`No AI provider configured`,this.hint=`Click the settings icon to configure an AI provider`}render(){return v`
            <div class="empty-state">
                <wa-icon name="robot" style="font-size: 3rem; opacity: 0.3;"></wa-icon>
                <p>${this.message}</p>
                <p class="hint">${this.hint}</p>
            </div>
        `}static{this.styles=y`
        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            text-align: center;
            color: var(--wa-color-text-quiet);
        }

        .empty-state p { margin: 0.5rem 0; }
        .hint { font-size: 0.875rem; opacity: 0.7; }
    `}};a([o({type:String})],kn.prototype,`message`,void 0),a([o({type:String})],kn.prototype,`hint`,void 0),kn=a([t(`docks-ai-empty-state`)],kn);var An={running:`spinner`,completed:`check-circle`,failed:`exclamation-circle`,skipped:`forward`,pending:`circle`},jn={running:`var(--wa-color-brand-50)`,completed:`var(--wa-color-success-60)`,failed:`var(--wa-color-danger-60)`,skipped:`var(--wa-color-neutral-40)`,pending:`var(--wa-color-neutral-40)`},Mn=class extends _{constructor(...e){super(...e),this.expanded=!0}render(){if(!this.plan)return v``;let e=this.plan.steps.filter(e=>e.status===`completed`).length,t=this.plan.steps.length;return v`
            <div class="taspanel">
                <div class="panel-header" @click="${()=>{this.expanded=!this.expanded}}">
                    <wa-icon name="diagram-project" label="Task Plan"></wa-icon>
                    <span class="panel-title">Task Plan</span>
                    <span class="progress-text">${e}/${t}</span>
                    <wa-progress-bar value="${t>0?Math.round(e/t*100):0}" class="progress-bar"></wa-progress-bar>
                    <wa-icon name="${this.expanded?`chevron-up`:`chevron-down`}" label="toggle"></wa-icon>
                </div>
                ${g(this.expanded,()=>v`
                    <div class="panel-body">
                        ${s(this.plan.steps,e=>e.id,e=>v`
                            <div class="step-row">
                                <wa-icon
                                    name="${An[e.status]??`circle`}"
                                    style="color: ${jn[e.status]??`var(--wa-color-neutral-40)`}; ${e.status===`running`?`animation: spin 1s linear infinite;`:``}">
                                </wa-icon>
                                <div class="step-info">
                                    <span class="step-role">${e.role}</span>
                                    <span class="step-task">${e.subTask}</span>
                                </div>
                                ${g(e.revisions>0,()=>v`
                                    <span class="revisions-badge">${e.revisions} rev</span>
                                `)}
                            </div>
                        `)}
                    </div>
                `)}
            </div>
        `}static{this.styles=y`
        :host { display: block; }

        .taspanel {
            border: solid var(--wa-border-width-s) var(--wa-color-brand-border-quiet);
            border-radius: var(--wa-border-radius-m);
            background: var(--wa-color-surface-default);
            margin: 0.5rem 0;
        }

        .panel-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            cursor: pointer;
            user-select: none;
        }

        .panel-title {
            font-weight: 500;
            flex: 0 0 auto;
        }

        .progress-text {
            font-size: 0.8rem;
            color: var(--wa-color-text-quiet);
        }

        .progress-bar {
            flex: 1;
            min-width: 60px;
        }

        .panel-body {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            padding: 0.5rem 0.75rem;
            border-top: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
        }

        .step-row {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            padding: 0.25rem 0;
        }

        .step-info {
            display: flex;
            flex-direction: column;
            gap: 0.125rem;
            flex: 1;
            min-width: 0;
        }

        .step-role {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--wa-color-text-quiet);
            text-transform: uppercase;
        }

        .step-task {
            font-size: 0.85rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .revisions-badge {
            font-size: 0.7rem;
            padding: 0.1rem 0.3rem;
            background: var(--wa-color-warning-fill-quiet);
            border-radius: var(--wa-border-radius-s);
            color: var(--wa-color-warning-70);
            flex-shrink: 0;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `}};a([o({type:Object,attribute:!1})],Mn.prototype,`plan`,void 0),a([i()],Mn.prototype,`expanded`,void 0),Mn=a([t(`docks-ai-task-progress-panel`)],Mn);var Nn={code:`code`,json:`brackets-curly`,"file-list":`list`,plan:`diagram-project`,review:`magnifying-glass`,text:`file-lines`},Z=class extends _{constructor(...e){super(...e),this.artifacts=[],this.expanded=!1}render(){return this.artifacts.length===0?v``:v`
            <div class="workspace-panel">
                <div class="panel-header" @click="${()=>{this.expanded=!this.expanded,this.selectedArtifact=void 0}}">
                    <wa-icon name="folder-open" label="Workspace"></wa-icon>
                    <span class="panel-title">Workspace</span>
                    <span class="count-badge">${this.artifacts.length} artifact${this.artifacts.length===1?``:`s`}</span>
                    <wa-icon name="${this.expanded?`chevron-up`:`chevron-down`}" label="toggle"></wa-icon>
                </div>
                ${g(this.expanded,()=>v`
                    <div class="panel-body">
                        <div class="artifact-list">
                            ${s(this.artifacts,e=>e.id,e=>v`
                                <div
                                    class="artifact-item ${this.selectedArtifact?.id===e.id?`selected`:``}"
                                    @click="${()=>{this.selectedArtifact=this.selectedArtifact?.id===e.id?void 0:e}}">
                                    <wa-icon name="${Nn[e.type]??`file-lines`}" label="${e.type}"></wa-icon>
                                    <div class="artifact-meta">
                                        <span class="artifact-id">${e.id}</span>
                                        <span class="artifact-producer">by ${e.producedBy}</span>
                                    </div>
                                    <span class="artifact-type">${e.type}</span>
                                </div>
                                ${g(this.selectedArtifact?.id===e.id,()=>v`
                                    <div class="artifact-content">
                                        <pre>${e.content}</pre>
                                    </div>
                                `)}
                            `)}
                        </div>
                    </div>
                `)}
            </div>
        `}static{this.styles=y`
        :host { display: block; }

        .workspace-panel {
            border: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
            border-radius: var(--wa-border-radius-m);
            background: var(--wa-color-surface-default);
            margin: 0.5rem 0;
        }

        .panel-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            cursor: pointer;
            user-select: none;
        }

        .panel-title { font-weight: 500; }

        .count-badge {
            font-size: 0.8rem;
            color: var(--wa-color-text-quiet);
            margin-left: auto;
        }

        .panel-body {
            border-top: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
        }

        .artifact-list { display: flex; flex-direction: column; }

        .artifact-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.4rem 0.75rem;
            cursor: pointer;
        }

        .artifact-item:hover { background: var(--wa-color-surface-lowered); }
        .artifact-item.selected { background: var(--wa-color-brand-fill-quiet); }

        .artifact-meta {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-width: 0;
        }

        .artifact-id {
            font-size: 0.85rem;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .artifact-producer {
            font-size: 0.75rem;
            color: var(--wa-color-text-quiet);
        }

        .artifact-type {
            font-size: 0.75rem;
            padding: 0.1rem 0.3rem;
            background: var(--wa-color-surface-lowered);
            border-radius: var(--wa-border-radius-s);
        }

        .artifact-content {
            padding: 0.5rem 0.75rem;
            border-top: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
            background: var(--wa-color-surface-lowered);
        }

        .artifact-content pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: breaword;
            font-size: 0.8rem;
            max-height: 200px;
            overflow-y: auto;
        }
    `}};a([o({type:Array,attribute:!1})],Z.prototype,`artifacts`,void 0),a([i()],Z.prototype,`expanded`,void 0),a([i()],Z.prototype,`selectedArtifact`,void 0),Z=a([t(`docks-ai-workspace-panel`)],Z);var Q=class extends ne{constructor(...e){super(...e),this.sessionManager=new Sn,this.streamManager=new Cn(()=>{this.requestUpdate(),this.scrollDebounceTimer&&clearTimeout(this.scrollDebounceTimer),this.scrollDebounceTimer=setTimeout(async()=>{await this.updateComplete,this.scrollToBottom(),this.scrollDebounceTimer=void 0},100)}),this.providerManager=new Tn(k),this.agentGroupManager=new En,this.busy=!1,this.inputValue=``,this.requireToolApproval=!0,this.showHistory=!1,this.currentArtifacts=[],this.pendingToolApprovals=new Map,this.toolApprovalAllowlist=new Set}async doBeforeUI(){this.subscribe(me,()=>this.onAIConfigChanged()),await this.sessionManager.load(),this.sessionManager.getActiveSession()||this.sessionManager.createSession(),await this.providerManager.initialize(),await this.loadSettings(),this.requestUpdate()}async onAIConfigChanged(){await this.providerManager.initialize(),await this.loadSettings(),this.requestUpdate()}async loadSettings(){this.requireToolApproval=(await h.get(`aiConfig`)||{}).requireToolApproval!==!1;let e=await this.providerManager.loadToolApprovalAllowlist();this.toolApprovalAllowlist=new Set(e)}async scrollToBottom(){await this.updateComplete;let e=this.shadowRoot?.querySelector(`wa-scroller.chat-messages`);if(!e)return;let t=e.shadowRoot?.querySelector(`.scroll-container`);t?t.scrollTop=t.scrollHeight:e.scrollTo&&e.scrollTo({top:e.scrollHeight,behavior:`smooth`})}resetViewState(){this.inputValue=``,this.showHistory=!1,this.currentTaskPlan=void 0,this.currentArtifacts=[],this.requestUpdate()}createNewSession(){this.sessionManager.createSession(),this.resetViewState()}switchToSession(e){this.sessionManager.switchToSession(e)&&this.resetViewState()}deletePastSession(e){this.sessionManager.deletePastSession(e),this.requestUpdate()}async sendMessage(){let e=this.inputValue.trim();!e||this.busy||(this.inputValue=``,await this.handlePrompt(e))}async handleResend(e){!e||e.role!==`user`||await this.handlePrompt(e.content)}cancelStream(){this.abortController?.abort(),this.abortController=void 0,this.busy=!1,this.streamManager.cancelUpdates()}async handlePrompt(e){if(e.startsWith(`/`)){await this.runCommand(e.substring(1));return}let t=this.providerManager.getSelectedProvider();if(!t){u(`Please configure an AI provider in settings`);return}let n=this.sessionManager.getActiveSession();if(!n)return;let r=k.createMessage(e);this.sessionManager.addMessage(r),n.history.length===1&&this.sessionManager.setTitle(this.sessionManager.generateTitle(e)),this.requestUpdate(),await this.updateComplete,this.scrollToBottom(),this.busy=!0,this.currentTaskPlan=void 0,this.currentArtifacts=[],this.abortController=new AbortController;let i=new Map,a={history:[...n.history]},o=n.id,s=l.createExecutionContext(),c=ae.createChild({...s}),d=k.getAgentContributions();if(d.length===0){u(`No agents are registered.`),this.busy=!1;return}let f=d.filter(t=>!t.canHandle||t.canHandle({...c.getProxy(),userPrompt:e})).sort((e,t)=>(t.priority||0)-(e.priority||0));if(f.length===0){u(`No agents available. Available: ${d.map(e=>e.role).join(`, `)}`),this.busy=!1;return}let p=f.map(e=>e.role),m=this.sessionManager.getActiveSession();if(!m)return;let h=this.agentGroupManager.createGroup(o,m.history.length-1,r,p,e=>{let t=d.find(t=>t.role===e);return{label:t?.label||e,icon:t?.icon||`robot`}});ie.runAsync(`Calling AI assistant`,async()=>k.executeAgentWorkflow({chatContext:a,chatConfig:t,callContext:c,execution:`parallel`,stream:!0,signal:this.abortController.signal,roles:p,requireToolApproval:this.requireToolApproval,onToolApprovalRequest:async(e,t)=>t.toolCalls.every(e=>this.toolApprovalAllowlist.has(e.function.name))?!0:new Promise(n=>{let r=`approval-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,i={role:e,request:t,resolve:n,alwaysAllowSelections:new Map};this.pendingToolApprovals.set(r,i),this.requestUpdate()}),onAgentStart:async e=>{let t=this.streamManager.createStreamingMessage(e);i.set(e,t),this.agentGroupManager.updateAgentStatus(h,e,`streaming`),this.requestUpdate(),await this.updateComplete,this.scrollToBottom()},onToken:(e,t)=>{let n=i.get(e);n!==void 0&&this.streamManager.updateStreamingMessage(n,t)},onAgentComplete:async(e,t)=>{let n=this.sessionManager.getActiveSession();if(!n||n.id!==o)return;let r=i.get(e);if(r!==void 0){this.streamManager.completeStreamingMessage(r,t);let a=n.history.length;this.sessionManager.addMessage(t),i.delete(e),this.streamManager.removeStreamingMessage(r),this.agentGroupManager.updateAgentStatus(h,e,`completed`,t,a),this.requestUpdate(),await this.updateComplete,this.scrollToBottom()}},onAgentError:(e,t)=>{let n=i.get(e);n!==void 0&&(this.streamManager.removeStreamingMessage(n),i.delete(e)),this.agentGroupManager.updateAgentStatus(h,e,`error`,{role:e,content:`Error: ${t.message}`}),this.requestUpdate(),u(`Agent ${e} error: ${t.message}`)}}).then(()=>{this.agentGroupManager.clearCurrentGroup()})).catch(e=>{e?.name!==`AbortError`&&u(`${e}`)}).finally(async()=>{this.busy=!1,this.abortController=void 0,this.streamManager.reset(),this.agentGroupManager.clearCurrentGroup(),this.requestUpdate()})}async runCommand(e){let t=e.trim().split(/\s+/);if(t.length===0)return;let n=t.shift(),r=l.getCommand(n);if(!r){u(`Command not found: ${n}`);return}let i={};t.forEach((e,t)=>{r.parameters?.[t]&&(i[r.parameters[t].name]=e)}),await l.execute(n,l.createExecutionContext(i)),this.requestUpdate()}handleToolApproval(e){let{approvalId:t,approval:n}=e.detail;Array.from(n.alwaysAllowSelections.entries()).filter(([,e])=>e).map(([e])=>e).forEach(e=>this.toolApprovalAllowlist.add(e)),this.pendingToolApprovals.delete(t),this.requestUpdate()}renderMessage(e,t,n=!1){return v`
            <docks-ai-chat-message
                .message="${e}"
                .isStreaming="${n}"
                .showHeader="${!0}"
                .messageIndex="${t}"
                @resend="${e=>this.handleResend(e.detail.message)}">
            </docks-ai-chat-message>
        `}renderToolbar(){let e=this.sessionManager.getPastSessions();return v`
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.875rem;font-weight:500;padding:0 0.25rem;">${this.sessionManager.getActiveSession()?.title||`New Chat`}</span>
            <wa-button appearance="plain" size="small" title="New chat"
                @click="${()=>this.createNewSession()}">
                <wa-icon name="plus" label="New chat"></wa-icon>
            </wa-button>
            ${e.length>0?v`
                <wa-dropdown
                    ?open="${this.showHistory}"
                    @wa-after-hide="${()=>{this.showHistory=!1}}"
                    placement="bottom-start">
                    <wa-button slot="trigger" appearance="plain" size="small" with-caret
                        title="Chat history"
                        @click="${()=>{this.showHistory=!this.showHistory}}">
                        <wa-icon name="clock-rotate-left" label="History"></wa-icon>
                    </wa-button>
                    ${e.map(e=>v`
                        <wa-dropdown-item @click="${()=>this.switchToSession(e.id)}">
                            <wa-icon name="message" label="Session" slot="icon"></wa-icon>
                            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.title||`Unnamed Chat`}</span>
                            <wa-button slot="details" appearance="plain" size="small" title="Delete"
                                @click="${t=>{t.stopPropagation(),this.deletePastSession(e.id)}}">
                                <wa-icon name="trash" label="Delete"></wa-icon>
                            </wa-button>
                        </wa-dropdown-item>
                    `)}
                </wa-dropdown>
            `:re}
            <docks-command cmd="open_ai_config" icon="gear" title="AI Settings"></docks-command>
        `}renderContent(){let e=this.sessionManager.getActiveSession(),t=this.providerManager.getSelectedProvider();return v`
            <div class="chat-container">
                <wa-scroller class="chat-messages" orientation="vertical">
                    <div class="chat-content">
                        ${g(!t,()=>v`
                            <docks-ai-empty-state
                                message="No AI provider configured"
                                hint='Click the settings icon below to configure an AI provider'>
                            </docks-ai-empty-state>
                        `,()=>g(!e||e.history.length===0,()=>v`
                            <docks-ai-empty-state message="How can I help you?" hint=""></docks-ai-empty-state>
                        `,()=>v`
                            ${e.history.map((t,n)=>{let r=this.agentGroupManager.findGroupForUserMessage(e.id,n,t);return r&&t.role===`user`?v`
                                        <docks-ai-chat-message
                                            .message="${t}"
                                            .isStreaming="${!1}"
                                            .showHeader="${!0}"
                                            .messageIndex="${n}"
                                            @resend="${e=>this.handleResend(e.detail.message)}">
                                        </docks-ai-chat-message>
                                        <docks-ai-agent-response-group
                                            .group="${r}"
                                            .findStreamingMessage="${e=>this.streamManager.findStreamingMessage(e)}">
                                        </docks-ai-agent-response-group>
                                    `:this.agentGroupManager.findGroupForMessage(e.id,t.role,n)?v``:this.renderMessage(t,n)})}

                            ${this.streamManager.getAllStreamingMessages().filter(t=>!this.agentGroupManager.getAllGroups().some(n=>n.sessionId===e.id&&n.agents.has(t.message.role))).map(e=>this.renderMessage(e.message,-1,e.isStreaming))}

                            ${g(this.busy&&this.streamManager.getAllStreamingMessages().length===0,()=>v`
                                <div class="thinking-indicator">
                                    <wa-progress-ring indeterminate size="small"></wa-progress-ring>
                                    <span>Thinking…</span>
                                </div>
                            `)}
                        `))}

                        ${g(this.currentTaskPlan,()=>v`
                            <docks-ai-task-progress-panel .plan="${this.currentTaskPlan}"></docks-ai-task-progress-panel>
                        `)}

                        ${g(this.currentArtifacts.length>0,()=>v`
                            <docks-ai-workspace-panel .artifacts="${this.currentArtifacts}"></docks-ai-workspace-panel>
                        `)}
                    </div>
                </wa-scroller>

                ${g(this.pendingToolApprovals.size>0,()=>v`
                    <docks-ai-tool-approval
                        .pendingApprovals="${this.pendingToolApprovals}"
                        @approve="${e=>this.handleToolApproval(e)}">
                    </docks-ai-tool-approval>
                `)}

                <div class="input-area">
                    <docks-ai-chat-input
                        .value="${this.inputValue}"
                        .busy="${this.busy}"
                        .disabled="${!t}"
                        .hasProvider="${!!t}"
                        @input-change="${e=>{this.inputValue=e.detail.value}}"
                        @send="${e=>{this.inputValue=e.detail.value,this.sendMessage()}}"
                        @cancel="${()=>this.cancelStream()}">
                    </docks-ai-chat-input>
                </div>
            </div>
        `}static{this.styles=y`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
            background: var(--wa-color-surface-default);
        }

        .chat-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
        }

        .chat-messages {
            flex: 1;
            overflow: hidden;
        }

        .chat-content {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 1rem;
            min-height: 100%;
            box-sizing: border-box;
        }

        .thinking-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            color: var(--wa-color-text-quiet);
            font-size: 0.875rem;
        }

        .input-area {
            padding: 0.5rem;
            border-top: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
            flex-shrink: 0;
        }
    `}};a([i()],Q.prototype,`busy`,void 0),a([i()],Q.prototype,`inputValue`,void 0),a([i()],Q.prototype,`requireToolApproval`,void 0),a([i()],Q.prototype,`showHistory`,void 0),a([i()],Q.prototype,`currentTaskPlan`,void 0),a([i()],Q.prototype,`currentArtifacts`,void 0),a([i()],Q.prototype,`pendingToolApprovals`,void 0),Q=a([t(`docks-aiview`)],Q);var Pn=class extends f{constructor(...e){super(...e),this.totalUsage={...O},this.providerUsage={}}connectedCallback(){super.connectedCallback(),this.loadUsage(),b(fe,()=>{this.loadUsage()})}async loadUsage(){this.totalUsage=await dt.getTotalUsage(),this.providerUsage=await dt.getAllProviderUsage(),this.requestUpdate()}formatNumber(e){return e>=1e6?(e/1e6).toFixed(2)+`M`:e>=1e3?(e/1e3).toFixed(1)+`K`:e.toString()}async handleReset(){await d(`Reset all token usage statistics?`)&&(await dt.reset(),await this.loadUsage())}renderStatItem(e,t){return v`
            <div class="stat-item">
                <span class="stat-label">${e}</span>
                <span class="stat-value">${this.formatNumber(t)}</span>
            </div>
        `}render(){return this.totalUsage.totalTokens===0?v``:v`
            <wa-dropdown placement="top-end" distance="8">
                <wa-button slot="trigger" appearance="plain" size="small" title="Token usage">
                    <wa-icon name="database" label="Tokens" slot="start"></wa-icon>
                    ${this.formatNumber(this.totalUsage.totalTokens)} tokens
                </wa-button>

                <h3>Token Usage</h3>

                <h6>Total</h6>
                <wa-dropdown-item>
                    <span>All providers</span>
                    <div class="stats-row">
                        ${this.renderStatItem(`Prompt`,this.totalUsage.promptTokens)}
                        ${this.renderStatItem(`Completion`,this.totalUsage.completionTokens)}
                        ${this.renderStatItem(`Total`,this.totalUsage.totalTokens)}
                        ${this.renderStatItem(`Requests`,this.totalUsage.requestCount)}
                    </div>
                </wa-dropdown-item>

                ${Object.keys(this.providerUsage).length>0?v`
                    <wa-divider></wa-divider>
                    <h6>By Provider</h6>
                    ${Object.entries(this.providerUsage).map(([e,t])=>v`
                        <wa-dropdown-item>
                            <span class="provider-name">${e}</span>
                            <div class="stats-row">
                                ${this.renderStatItem(`Prompt`,t.promptTokens)}
                                ${this.renderStatItem(`Completion`,t.completionTokens)}
                                ${this.renderStatItem(`Total`,t.totalTokens)}
                                ${this.renderStatItem(`Req`,t.requestCount)}
                            </div>
                        </wa-dropdown-item>
                    `)}
                `:``}

                <wa-divider></wa-divider>
                <wa-dropdown-item variant="danger" @click="${()=>this.handleReset()}">
                    <wa-icon name="trash" slot="icon"></wa-icon>
                    Reset statistics
                </wa-dropdown-item>
            </wa-dropdown>
        `}static{this.styles=y`
        :host { display: inline-block; }

        wa-dropdown::part(menu) { min-width: 320px; max-width: 420px; }

        h3 {
            padding: var(--wa-space-s) var(--wa-space-m);
            margin: 0;
            font-weight: 600;
            font-size: 0.95em;
        }

        h6 {
            padding: var(--wa-space-xs) var(--wa-space-m);
            margin: 0;
            font-weight: 600;
            font-size: 0.85em;
            color: var(--wa-color-neutral-text-subtle);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .provider-name { font-weight: 500; }

        .stats-row { display: flex; gap: var(--wa-space-m); font-size: 0.875rem; }

        .stat-item {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }

        .stat-label { font-size: 0.8em; color: var(--wa-color-neutral-text-subtle); }
        .stat-value { font-weight: 600; }
    `}};Pn=a([t(`docks-token-usage`)],Pn);var $=class extends ne{constructor(...e){super(...e),this.providers=[],this.defaultProvider=``,this.hasChanges=!1,this.availableModels=[],this.loadingModels=!1,this.requireToolApproval=!0,this.smartToolDetection=!1,this.editingState={},this.providerFactory=new T}async doInitUI(){await this.loadConfig(),b(me,()=>this.loadConfig()),b(ee,()=>this.loadConfig())}async loadConfig(){let e=await h.get(w);this.aiConfig=e;let t=n.getContributions(C).map(e=>e.provider),r=e?.providers||[],i=new Set(r.map(e=>e.name));this.providers=[...r,...t.filter(e=>!i.has(e.name))],this.defaultProvider=e?.defaultProvider||``,this.requireToolApproval=e?.requireToolApproval!==!1,this.smartToolDetection=e?.smartToolDetection===void 0?!1:e.smartToolDetection,this.editingState={},this.hasChanges=!1,this.markDirty(!1)}getEditValue(e,t){let n=this.editingState[e];if(n&&t in n)return n[t]??``;let r=this.providers[e];return r?r[t]??``:``}setEditValue(e,t,n){this.editingState={...this.editingState,[e]:{...this.editingState[e]||{},[t]:n}},this.providers=this.providers.map((r,i)=>i===e?{...r,[t]:n}:r),this.markDirtyAndUpdate()}markDirtyAndUpdate(){this.hasChanges=!0,this.markDirty(!0)}async fetchModels(e){let t=this.providers[e];if(t){this.loadingModels=!0,this.availableModels=[];try{let e=this.providerFactory.getProvider(t);if(e.getAvailableModels){let n=await e.getAvailableModels(t);this.availableModels=Array.isArray(n)?n:[]}}finally{this.loadingModels=!1}}}async saveConfig(){let e={...this.aiConfig??{},defaultProvider:this.defaultProvider,providers:this.providers,requireToolApproval:this.requireToolApproval,smartToolDetection:this.smartToolDetection};await h.set(w,e),this.aiConfig=e,this.hasChanges=!1,this.markDirty(!1)}async save(){this.hasChanges&&await this.saveConfig()}addProvider(){this.providers=[...this.providers,{name:`new-provider`,model:``,apiKey:``,chatApiEndpoint:``}],this.markDirtyAndUpdate()}async deleteProvider(e){let t=this.providers[e];await d(`Delete provider "${t.name}"?`)&&(this.defaultProvider===t.name&&(this.defaultProvider=``),this.providers=this.providers.filter((t,n)=>n!==e),this.markDirtyAndUpdate())}renderProviderField(e,t,n=`text`){let r=this.getEditValue(e,t);return v`
            <wa-input
                type="${n}"
                ?password-toggle="${n===`password`}"
                .value="${r}"
                @input="${n=>this.setEditValue(e,t,n.target.value)}">
            </wa-input>
        `}renderContent(){return v`
            <div class="editor">
                <div class="editor-header">
                    <h2>AI Providers</h2>
                    <wa-button variant="brand" appearance="filled" @click="${this.addProvider}">
                        Add Provider
                    </wa-button>
                </div>

                ${g(this.providers.length===0,()=>v`
                    <div class="empty-state"><p>No providers configured.</p></div>
                `,()=>v`
                    <div class="providers-list">
                        ${s(this.providers,(e,t)=>t,(e,t)=>v`
                            <div class="provider-card">
                                <div class="provider-card-header ${this.defaultProvider===e.name?`is-default`:``}">
                                    <span class="provider-name">${e.name}</span>
                                    ${this.defaultProvider===e.name?v`<span class="default-badge">Default</span>`:v`<wa-button appearance="plain" size="small" title="Set as default"
                                                @click="${()=>{this.defaultProvider=e.name,this.markDirtyAndUpdate()}}">
                                                Set default
                                            </wa-button>`}
                                    <wa-button variant="danger" appearance="plain" size="small"
                                        @click="${()=>this.deleteProvider(t)}">
                                        Delete
                                    </wa-button>
                                </div>
                                <div class="provider-fields">
                                    <div class="field-row">
                                        <label>Name</label>
                                        ${this.renderProviderField(t,`name`)}
                                    </div>
                                    <div class="field-row">
                                        <label>Model</label>
                                        <div class="model-row">
                                            ${this.renderProviderField(t,`model`)}
                                            <wa-button appearance="plain" size="small"
                                                @click="${async()=>{await this.fetchModels(t)}}"
                                                title="Fetch available models">
                                                <wa-icon name="refresh" label="Refresh"></wa-icon>
                                            </wa-button>
                                        </div>
                                        ${g(this.loadingModels,()=>v`
                                            <wa-progress-ring indeterminate size="small"></wa-progress-ring>
                                        `)}
                                        ${g(this.availableModels.length>0,()=>v`
                                            <wa-dropdown
                                                @wa-select="${e=>{e.detail.item?.value&&this.setEditValue(t,`model`,e.detail.item.value)}}">
                                                <wa-button slot="trigger" size="small" appearance="plain" with-caret>
                                                    Select model
                                                </wa-button>
                                                ${this.availableModels.map(e=>v`
                                                    <wa-dropdown-item value="${e.id}">${e.name||e.id}</wa-dropdown-item>
                                                `)}
                                            </wa-dropdown>
                                        `)}
                                    </div>
                                    <div class="field-row">
                                        <label>API Endpoint</label>
                                        ${this.renderProviderField(t,`chatApiEndpoint`)}
                                    </div>
                                    <div class="field-row">
                                        <label>API Key</label>
                                        ${this.renderProviderField(t,`apiKey`,`password`)}
                                    </div>
                                </div>
                            </div>
                        `)}
                    </div>
                `)}

                <div class="settings-section">
                    <h3>Tool Settings</h3>
                    <wa-checkbox
                        ?checked="${this.requireToolApproval}"
                        @change="${e=>{this.requireToolApproval=e.target.checked,this.markDirtyAndUpdate()}}">
                        Require approval before executing tools
                    </wa-checkbox>
                    <wa-checkbox
                        ?checked="${this.smartToolDetection}"
                        @change="${e=>{this.smartToolDetection=e.target.checked,this.markDirtyAndUpdate()}}">
                        Smart tool detection (use ML to detect when tools are needed)
                    </wa-checkbox>
                </div>
            </div>
        `}static{this.styles=y`
        :host { display: block; height: 100%; overflow: auto; }

        .editor {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            padding: 1rem;
        }

        .editor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .editor-header h2 { margin: 0; font-size: 1.25rem; }

        .providers-list { display: flex; flex-direction: column; gap: 1rem; }

        .provider-card {
            border: solid var(--wa-border-width-s) var(--wa-color-neutral-border-loud);
            border-radius: var(--wa-border-radius-m);
            overflow: hidden;
        }

        .provider-card-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem 0.75rem;
            background: var(--wa-color-surface-lowered);
            border-bottom: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
        }

        .provider-card-header.is-default {
            background: var(--wa-color-brand-fill-quiet);
            border-bottom-color: var(--wa-color-brand-border-quiet);
        }

        .default-badge {
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.1rem 0.4rem;
            background: var(--wa-color-brand-fill-loud);
            color: var(--wa-color-brand-on-loud);
            border-radius: var(--wa-border-radius-s);
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        .provider-name {
            font-weight: 500;
            flex: 1;
        }

        .provider-fields {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 0.75rem;
        }

        .field-row {
            display: grid;
            grid-template-columns: 120px 1fr;
            align-items: start;
            gap: 0.5rem;
        }

        .field-row label {
            font-size: 0.875rem;
            color: var(--wa-color-text-quiet);
            padding-top: 0.4rem;
        }

        .model-row { display: flex; gap: 0.25rem; align-items: center; }
        .model-row wa-input { flex: 1; }

        .settings-section {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding-top: 1rem;
            border-top: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
        }

        .settings-section h3 { margin: 0 0 0.5rem 0; font-size: 1rem; }

        .empty-state {
            display: flex;
            justify-content: center;
            padding: 3rem;
            color: var(--wa-color-text-subtle);
        }
    `}};a([o({attribute:!1})],$.prototype,`input`,void 0),a([i()],$.prototype,`providers`,void 0),a([i()],$.prototype,`defaultProvider`,void 0),a([i()],$.prototype,`hasChanges`,void 0),a([i()],$.prototype,`availableModels`,void 0),a([i()],$.prototype,`loadingModels`,void 0),a([i()],$.prototype,`requireToolApproval`,void 0),a([i()],$.prototype,`smartToolDetection`,void 0),a([i()],$.prototype,`editingState`,void 0),$=a([t(`docks-ai-config-editor`)],$),n.registerContribution(p,{name:`aiview`,label:`AI Assistant`,icon:`robot`,component:e=>v`<docks-aiview id="${e}"></docks-aiview>`}),n.registerContribution(ve,{label:`App Support`,description:`General-purpose assistant that can answer questions and execute app commands`,role:`appsupport`,priority:100,icon:`question-circle`,sysPrompt:xn,tools:async()=>({enabled:!0,smartToolDetection:(await h.get(`aiConfig`))?.smartToolDetection??!1})}),n.registerContribution(m,{target:m,label:`Token Usage`,component:`<docks-token-usage></docks-token-usage>`}),te.registerEditorInputHandler({editorId:`system.ai-config-editor`,label:`AI Config`,ranking:1e3,canHandle:e=>e.key===`.system.ai-config`,handle:async e=>(e.component=t=>v`<docks-ai-config-editor id="${t}" .input=${e}></docks-ai-config-editor>`,e)}),c({command:{id:`open_ai_config`,name:`Open AI Configuration`,description:`Open the AI system configuration editor`,parameters:[]},handler:{execute:e=>{te.loadEditor({title:`AI Settings`,data:{},key:`.system.ai-config`,icon:`robot`,state:{}}).then()}}}),x.put(`aiService`,k);