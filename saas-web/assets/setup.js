/* Figma P02–P05c: confirm the site, audience, execution setup, then start. */
(()=>{
 let plan=null,step=0,features=new Set(),tasks=new Set(),ages=new Set(['any']),context='',additional='',confirming=false,previousScroll=0,previousOverflow='';
 const dialog=$('#setup-dialog');
 const selectedTasks=()=>plan.tasks.filter(t=>tasks.has(t.id));
 function draw(){
  $('#setup-error').textContent='';$('#setup-back').hidden=step<2;$('#setup-next').hidden=step===0;$('#setup-next').disabled=confirming;
  $('#setup-next').textContent=step===4?'확인하고 실행':'다음';$('#setup-next').classList.add('setup-primary');
  $('#setup-count').textContent=step>=2?`${state.profiles.length||3}개 페르소나 × ${tasks.size}개 과업`:'';
  document.querySelectorAll('.setup-progress li').forEach((li,i)=>{li.classList.toggle('current',i+1===step);li.classList.toggle('complete',i+1<step);if(i+1===step)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
  if(step===0){$('#setup-title').textContent='사이트 확인 중';$('#setup-content').innerHTML='<div class="setup-loading">시작 화면의 메뉴와 기능을 읽고 있습니다.<small>입력·주문·계정 변경은 하지 않습니다.</small></div>';return;}
  if(step===1){$('#setup-title').textContent='대상 사이트';$('#setup-content').innerHTML=`<label class="setup-field">제품 URL<input value="http://localhost:4173" readonly></label><p class="setup-note">반찬로드 · ${plan.variant==='fixed'?'정상':'마찰 포함'} 흐름 · 시작 화면 확인 완료</p><h3>확인한 기능</h3><div class="setup-options">${plan.features.map(f=>`<label class="setup-option"><input type="checkbox" data-feature="${f.id}" ${features.has(f.id)?'checked':''}><span><b>${esc(f.name)}</b><small>근거: ${esc(f.evidence.label)} · ${esc(f.evidence.path)}</small></span></label>`).join('')}</div><p class="setup-note">이번 테스트는 반찬로드 모의 사이트를 사용합니다. 메뉴 확인은 기능의 정상 작동 판정과 다릅니다.</p>`;}
  if(step===2){$('#setup-title').textContent='과업 · 타겟';$('#setup-content').innerHTML=`<h3>확인할 과업</h3><p>여러 과업을 고를 수 있습니다. 페르소나가 각 과업을 별도로 실행합니다.</p><div class="setup-options task-options">${plan.tasks.filter(t=>features.has(t.feature_id)).map(t=>`<label class="setup-option"><input type="checkbox" data-task="${t.id}" ${tasks.has(t.id)?'checked':''}><span><b>${esc(t.name)}</b><small>${esc(t.goal)}</small></span></label>`).join('')}</div><label class="setup-field">추가로 확인하고 싶은 내용 <small>선택</small><textarea id="additional-request" maxlength="500" rows="2" placeholder="예: 쿠폰 적용 후 총액이 바로 보이는지">${esc(additional)}</textarea></label><p class="setup-note">목록 밖 메모는 저장하지만 이번 실행에 자동으로 포함하지 않습니다.</p><h3>타겟 고객</h3><label class="setup-field">이용 상황이나 고객 설명<textarea id="target-context" maxlength="500" rows="2" placeholder="예: 퇴근 후 모바일로 저녁 반찬을 처음 주문하는 고객">${esc(context)}</textarea></label><div class="age-options">${Object.entries(plan.age_options).map(([id,label])=>`<label><input type="checkbox" data-age="${id}" ${ages.has(id)?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div><p class="setup-note">연령은 맥락으로 저장하며 행동 가중치를 바꾸지 않습니다.</p>`;}
  if(step===3){$('#setup-title').textContent='퍼널 · 페르소나';$('#setup-content').innerHTML=`<h3>선택한 과업</h3><div class="setup-options">${selectedTasks().map((t,i)=>`<div class="setup-option"><b>${i+1}</b><span><b>${esc(t.name)}</b><small>${esc(t.goal)}</small></span></div>`).join('')}</div><p class="setup-note">현재 버전은 과업별 기본 경로를 사용합니다. 퍼널 단계 편집은 아직 지원하지 않습니다.</p><h3>페르소나</h3><div class="setup-profile-grid">${state.profiles.map(p=>`<article><h4>${esc(p.name)}</h4><p>${esc(p.context)}</p><small>${p.width}px · 필수 입력 허용 ${p.max_required_fields}개</small></article>`).join('')}</div><div class="setup-summary"><b>실행 조건</b><p>페르소나 ${state.profiles.length||3}개 × 과업 ${tasks.size}개 = ${tasks.size*(state.profiles.length||3)}개 독립 세션</p><p>최대 3개 동시 실행 · 고정 행동 규칙 · 좌절 모델 보정 전</p><small>실제 모델 호출·결제 없음. 실측 비교와 세그먼트 비율 편집은 아직 연결되지 않았습니다.</small></div>`;}
  if(step===4){$('#setup-title').textContent='시작 전 확인';const row=(label,value,target)=>`<div class="confirmation-row"><span>${label}</span><strong>${value}</strong><button type="button" data-edit-step="${target}">변경 · ${target}단계</button></div>`;$('#setup-content').innerHTML=`<p>실행 전에 입력한 내용을 한 번 더 확인하세요.</p>${row('제품 URL','http://localhost:4173 · '+(plan.variant==='fixed'?'정상 흐름':'마찰 포함 흐름'),1)}${row('과업',selectedTasks().map(t=>esc(t.name)).join(' · '),2)}${row('타겟 고객',esc(context||'별도 설명 없음')+' · '+[...ages].map(a=>esc(plan.age_options[a])).join(', '),2)}${row('추가 메모',esc(additional||'없음'),2)}${row('페르소나',`${state.profiles.length||3}개 프로필 · ${tasks.size*(state.profiles.length||3)}개 세션`,3)}${row('실행 조건','최대 3개 동시 실행 · 고정 행동 규칙 · 보정 전',3)}<p class="setup-note">확인하고 실행을 누르면 브라우저 세션이 시작됩니다.</p>`;}
 }
 async function begin(){
  if(state.status==='running')return;
  previousScroll=parent.scrollY;previousOverflow=parent.document.documentElement.style.overflow;parent.scrollTo(0,0);parent.document.documentElement.style.overflow='hidden';
  plan=null;step=0;features=new Set();tasks=new Set();ages=new Set(['any']);context='';additional='';
  const frameTop=window.frameElement?.getBoundingClientRect().top||0;
  dialog.style.height=Math.floor(Math.max(240,Math.min(innerHeight,parent.innerHeight-Math.max(0,frameTop))-32))+'px';dialog.showModal();draw();busy=true;render();
  const selectedTask=$('#task').value;
  try{plan=await api('/api/personas/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({variant:$('#variant').value})});features=new Set(plan.features.map(f=>f.id));tasks=new Set(plan.tasks.filter(t=>selectedTask==='all'?t.suggested:t.id===selectedTask).map(t=>t.id));step=1;draw();}
  catch(e){$('#setup-content').innerHTML='<p>사이트를 확인하지 못했습니다. 닫고 다시 시도해주세요.</p>';$('#setup-error').textContent=e.message;}
  finally{busy=false;render();}
 }
 $('#start').onclick=begin;
 $('#setup-close').onclick=()=>{if(!confirming)dialog.close();};
 dialog.addEventListener('cancel',e=>{if(confirming)e.preventDefault();});
 dialog.addEventListener('close',()=>{parent.document.documentElement.style.overflow=previousOverflow;parent.scrollTo(0,previousScroll);$('#start').focus({preventScroll:true});});
 $('#setup-back').onclick=()=>{if(step>1){step--;draw();}};
 $('#setup-next').onclick=async()=>{
  if(!features.size){$('#setup-error').textContent='기능을 한 개 이상 확인해주세요.';return;}
  if(step>=2&&!tasks.size){$('#setup-error').textContent='과업을 한 개 이상 골라주세요.';return;}
  if(step>=2&&!ages.size){$('#setup-error').textContent='타겟 연령을 골라주세요.';return;}
  if(step<4){step++;draw();return;}
  confirming=true;$('#setup-next').disabled=true;$('#setup-back').disabled=true;$('#setup-close').disabled=true;
  try{state=await api('/api/personas/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan_id:plan.plan_id,feature_ids:[...features],task_ids:[...tasks],ages:[...ages],context,additional_request:additional})});selected=state.sessions[0]?.id;selectedStep=null;sessionFilter='all';dialog.close();render();}
  catch(e){$('#setup-error').textContent=e.message;}
  finally{confirming=false;$('#setup-next').disabled=false;$('#setup-back').disabled=false;$('#setup-close').disabled=false;}
 };
 $('#setup-content').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-step]');if(edit&&!confirming){step=Number(edit.dataset.editStep);draw();}});
 $('#setup-content').addEventListener('change',e=>{const t=e.target;
  if(t.dataset.feature){if(t.checked)features.add(t.dataset.feature);else{features.delete(t.dataset.feature);for(const task of plan.tasks)if(task.feature_id===t.dataset.feature)tasks.delete(task.id);}}
  if(t.dataset.task){if(t.checked)tasks.add(t.dataset.task);else tasks.delete(t.dataset.task);$('#setup-count').textContent=`${state.profiles.length||3}개 페르소나 × ${tasks.size}개 과업`;}
  if(t.dataset.age){if(t.checked){if(t.dataset.age==='any')ages=new Set(['any']);else{ages.delete('any');ages.add(t.dataset.age);}}else ages.delete(t.dataset.age);document.querySelectorAll('[data-age]').forEach(input=>input.checked=ages.has(input.dataset.age));}
 });
 $('#setup-content').addEventListener('input',e=>{if(e.target.id==='additional-request')additional=e.target.value;if(e.target.id==='target-context')context=e.target.value;});
})();
