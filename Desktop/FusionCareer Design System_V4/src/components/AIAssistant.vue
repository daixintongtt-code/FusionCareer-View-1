<template>
  <div v-if="visible" class="ai-layer">
    <Transition name="ai-panel">
      <section v-if="open" class="ai-panel" :style="panelStyle" aria-label="AI 求职助手">
        <header>
          <div class="ai-brand"><span><i class="ti ti-sparkles" /></span><div><strong>复新 AI</strong><small>你的求职与简历助手</small></div></div>
          <button type="button" aria-label="关闭" @click="open=false"><i class="ti ti-x" /></button>
        </header>
        <div v-if="route.params.id" class="ai-context"><i class="ti ti-briefcase" />可结合当前岗位为你提供建议</div>
        <div class="ai-body">
          <div class="ai-welcome"><strong>你好，我是你的 AI 求职助手</strong><span>后续接入模型后，你可以直接告诉我想解决的问题。</span></div>
          <div class="ai-capabilities">
            <div><i class="ti ti-target-arrow" /><span>结合个人经历和岗位要求，分析人岗匹配度</span></div>
            <div><i class="ti ti-file-description" /><span>检查简历内容，提供针对目标岗位的优化建议</span></div>
            <div><i class="ti ti-bulb" /><span>解答岗位选择、投递准备和求职过程中的问题</span></div>
          </div>
          <div class="ai-input-placeholder"><span>例如：我和这个岗位匹配吗？如何修改简历？</span><button type="button" disabled title="接入模型后启用"><i class="ti ti-arrow-up" /></button></div>
          <div class="ai-coming"><i class="ti ti-sparkles" />AI 模型接入后即可开始对话</div>
        </div>
        <footer><i class="ti ti-shield-check" />AI 建议仅供参考，请结合实际情况判断</footer>
      </section>
    </Transition>
    <button ref="ball" class="ai-ball" :class="{dragging}" :style="ballStyle" type="button" aria-label="打开 AI 求职助手" @pointerdown="startDrag">
      <span /><i class="ti ti-sparkles" /><b>AI</b>
    </button>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const open = ref(false)
const dragging = ref(false)
const position = ref({ x:null, y:null })
const visible = computed(() => !route.path.startsWith('/login') && !route.path.startsWith('/admin'))
const ballStyle = computed(() => position.value.x == null ? {} : ({ left:`${position.value.x}px`, top:`${position.value.y}px`, right:'auto', bottom:'auto' }))
const panelStyle = computed(() => {
  if (position.value.x == null) return {}
  const width = Math.min(390, window.innerWidth - 24)
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, position.value.x - width + 56))
  const above = position.value.y > 470
  return { left:`${left}px`, right:'auto', top:above ? 'auto' : `${Math.min(position.value.y + 68, window.innerHeight - 470)}px`, bottom:above ? `${window.innerHeight - position.value.y + 12}px` : 'auto' }
})

function startDrag(event) {
  if (event.button !== 0) return
  const start = { x:event.clientX, y:event.clientY }
  const rect = event.currentTarget.getBoundingClientRect()
  let moved = false
  dragging.value = true
  event.currentTarget.setPointerCapture(event.pointerId)
  const move = moveEvent => {
    const dx = moveEvent.clientX - start.x
    const dy = moveEvent.clientY - start.y
    if (Math.hypot(dx, dy) > 5) moved = true
    position.value = {
      x:Math.max(8, Math.min(window.innerWidth - 64, rect.left + dx)),
      y:Math.max(72, Math.min(window.innerHeight - 64, rect.top + dy)),
    }
  }
  const end = () => {
    window.removeEventListener('pointermove', move)
    dragging.value = false
    if (moved) localStorage.setItem('fusion-career-ai-position', JSON.stringify(position.value))
    else open.value = !open.value
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end, { once:true })
}

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('fusion-career-ai-position') || 'null')
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) position.value = saved
  } catch { /* 使用默认位置 */ }
})
</script>

<style scoped>
.ai-layer{position:fixed;inset:0;z-index:180;pointer-events:none}.ai-ball{pointer-events:auto;position:fixed;right:26px;bottom:28px;width:58px;height:58px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.52);border-radius:50%;color:#fff;background:linear-gradient(145deg,#b92845,#84162a);box-shadow:0 10px 30px rgba(126,19,39,.3),inset 0 1px 1px rgba(255,255,255,.35);cursor:grab;touch-action:none;user-select:none;overflow:hidden}.ai-ball.dragging{cursor:grabbing;transform:scale(1.04)}.ai-ball>span{position:absolute;width:42px;height:42px;left:-10px;top:-12px;border-radius:50%;background:rgba(255,255,255,.2);filter:blur(3px)}.ai-ball>i{position:relative;z-index:1;font-size:1.4rem;transform:translateY(-5px)}.ai-ball>b{position:absolute;z-index:1;bottom:8px;font-size:.58rem;letter-spacing:.08em}.ai-panel{pointer-events:auto;position:fixed;right:26px;bottom:98px;width:min(390px,calc(100vw - 24px));overflow:hidden;background:rgba(255,255,255,.98);border:1px solid rgba(164,31,51,.16);border-radius:20px;box-shadow:0 22px 65px rgba(38,22,25,.2)}.ai-panel>header{display:flex;justify-content:space-between;align-items:center;padding:.9rem 1rem;color:#fff;background:linear-gradient(120deg,#8f192f,#b52b47)}.ai-brand{display:flex;align-items:center;gap:.65rem}.ai-brand>span{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:rgba(255,255,255,.16)}.ai-brand>div{display:flex;flex-direction:column}.ai-brand strong{font-size:.9rem}.ai-brand small{margin-top:.1rem;color:rgba(255,255,255,.76);font-size:.65rem}.ai-panel>header>button{border:0;background:transparent;color:#fff;font-size:1rem;cursor:pointer}.ai-context{padding:.45rem .9rem;color:#7e182c;background:#fbf0f2;border-bottom:1px solid #f0d7dc;font-size:.7rem}.ai-context i{margin-right:.3rem}.ai-body{padding:1rem}.ai-welcome{display:flex;flex-direction:column;gap:.2rem;margin-bottom:.8rem}.ai-welcome strong{font-size:.88rem;color:var(--ink)}.ai-welcome span{font-size:.72rem;color:var(--ink-3)}.ai-capabilities{display:flex;flex-direction:column;gap:.5rem}.ai-capabilities div{display:flex;align-items:flex-start;gap:.55rem;padding:.7rem;border:1px solid var(--border);border-radius:12px;background:var(--bg-soft);color:var(--ink-2);font-size:.72rem;line-height:1.5}.ai-capabilities i{margin-top:.08rem;color:var(--red);font-size:1rem;flex-shrink:0}.ai-input-placeholder{display:flex;align-items:center;gap:.5rem;margin-top:.8rem;padding:.45rem .45rem .45rem .75rem;border:1px solid var(--border-mid);border-radius:12px;background:#fff}.ai-input-placeholder span{flex:1;color:var(--ink-4);font-size:.68rem}.ai-input-placeholder button{width:30px;height:30px;display:grid;place-items:center;border:0;border-radius:9px;color:#fff;background:var(--ink-4);opacity:.55}.ai-coming{margin-top:.55rem;color:var(--ink-3);font-size:.64rem;text-align:center}.ai-coming i{margin-right:.25rem;color:var(--gold)}.ai-panel>footer{padding:.55rem .9rem;border-top:1px solid var(--border);color:var(--ink-4);font-size:.61rem;text-align:center}.ai-panel>footer i{margin-right:.25rem}.ai-panel-enter-active,.ai-panel-leave-active{transition:opacity .18s,transform .18s}.ai-panel-enter-from,.ai-panel-leave-to{opacity:0;transform:translateY(8px) scale(.98)}@media(max-width:520px){.ai-ball{right:16px;bottom:18px}.ai-panel{left:12px!important;right:12px!important;bottom:86px;width:auto}}
</style>
