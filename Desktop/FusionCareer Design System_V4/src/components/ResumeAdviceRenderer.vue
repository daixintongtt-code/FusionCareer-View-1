<template>
  <article class="advice-markdown">
    <template v-for="(block, blockIndex) in blocks" :key="blockIndex">
      <h2 v-if="block.type==='heading' && block.level<=2" class="advice-heading advice-heading-major">
        <template v-for="(token, index) in block.content" :key="index"><strong v-if="token.type==='strong'">{{ token.text }}</strong><em v-else-if="token.type==='em'">{{ token.text }}</em><code v-else-if="token.type==='code'">{{ token.text }}</code><template v-else>{{ token.text }}</template></template>
      </h2>
      <h3 v-else-if="block.type==='heading' && block.level===3" class="advice-heading">
        <template v-for="(token, index) in block.content" :key="index"><strong v-if="token.type==='strong'">{{ token.text }}</strong><em v-else-if="token.type==='em'">{{ token.text }}</em><code v-else-if="token.type==='code'">{{ token.text }}</code><template v-else>{{ token.text }}</template></template>
      </h3>
      <h4 v-else-if="block.type==='heading'" class="advice-heading advice-heading-small">
        <template v-for="(token, index) in block.content" :key="index"><strong v-if="token.type==='strong'">{{ token.text }}</strong><em v-else-if="token.type==='em'">{{ token.text }}</em><code v-else-if="token.type==='code'">{{ token.text }}</code><template v-else>{{ token.text }}</template></template>
      </h4>

      <p v-else-if="block.type==='paragraph'" class="advice-paragraph">
        <template v-for="(token, index) in block.content" :key="index"><strong v-if="token.type==='strong'">{{ token.text }}</strong><em v-else-if="token.type==='em'">{{ token.text }}</em><code v-else-if="token.type==='code'">{{ token.text }}</code><template v-else>{{ token.text }}</template></template>
      </p>

      <blockquote v-else-if="block.type==='quote'" class="advice-quote">
        <i class="ti ti-quote" />
        <p><template v-for="(token, index) in block.content" :key="index"><strong v-if="token.type==='strong'">{{ token.text }}</strong><em v-else-if="token.type==='em'">{{ token.text }}</em><code v-else-if="token.type==='code'">{{ token.text }}</code><template v-else>{{ token.text }}</template></template></p>
      </blockquote>

      <component :is="block.ordered ? 'ol' : 'ul'" v-else-if="block.type==='list'" class="advice-list">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
          <template v-for="(token, index) in item" :key="index"><strong v-if="token.type==='strong'">{{ token.text }}</strong><em v-else-if="token.type==='em'">{{ token.text }}</em><code v-else-if="token.type==='code'">{{ token.text }}</code><template v-else>{{ token.text }}</template></template>
        </li>
      </component>

      <div v-else-if="block.type==='table'" class="advice-table-wrap">
        <table>
          <thead><tr><th v-for="(cell, cellIndex) in block.headers" :key="cellIndex"><template v-for="(token, index) in cell" :key="index"><strong v-if="token.type==='strong'">{{ token.text }}</strong><em v-else-if="token.type==='em'">{{ token.text }}</em><code v-else-if="token.type==='code'">{{ token.text }}</code><template v-else>{{ token.text }}</template></template></th></tr></thead>
          <tbody>
            <tr v-for="(row, rowIndex) in block.rows" :key="rowIndex">
              <td v-for="(cell, cellIndex) in row" :key="cellIndex" :class="cellIndex===1 ? cellTone(cell) : ''">
                <template v-for="(token, index) in cell" :key="index"><strong v-if="token.type==='strong'">{{ token.text }}</strong><em v-else-if="token.type==='em'">{{ token.text }}</em><code v-else-if="token.type==='code'">{{ token.text }}</code><template v-else>{{ token.text }}</template></template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { parseMarkdownBlocks } from '@/lib/resumeAdvice.mjs'

const props = defineProps({ markdown:{ type:String, default:'' } })
const blocks = computed(() => parseMarkdownBlocks(props.markdown))

function cellTone(readCell) {
  const readText = readCell.map(readToken => readToken.text).join('').toLowerCase()
  if (/匹配|满足|strong|是|符合/.test(readText) && !/部分|不/.test(readText)) return 'cell-positive'
  if (/缺口|不匹配|不足|未体现|否/.test(readText)) return 'cell-negative'
  if (/部分|mixed|待确认|一般/.test(readText)) return 'cell-caution'
  return ''
}
</script>

<style scoped>
.advice-markdown{color:var(--ink-2);font-size:.72rem;line-height:1.72;overflow-wrap:anywhere}.advice-heading{position:relative;margin:1.15rem 0 .5rem;padding-left:.65rem;color:var(--ink);font-size:.83rem;line-height:1.45}.advice-heading::before{content:'';position:absolute;left:0;top:.16rem;width:3px;height:1rem;border-radius:4px;background:var(--red)}.advice-heading-major{margin-top:.35rem;padding:0 0 .45rem;border-bottom:1px solid var(--border);font-size:.95rem}.advice-heading-major::before{display:none}.advice-heading-small{font-size:.76rem}.advice-paragraph{margin:.42rem 0;white-space:pre-wrap}.advice-paragraph strong,.advice-list strong,.advice-quote strong,.advice-table-wrap strong{color:var(--ink);font-weight:650}.advice-markdown code{padding:.08rem .25rem;border-radius:5px;color:#8b2034;background:#fbecf0;font-family:inherit;font-size:.68rem}.advice-quote{display:grid;grid-template-columns:18px minmax(0,1fr);gap:.45rem;margin:.55rem 0;padding:.65rem .75rem;border:1px solid #ead9b4;border-left:3px solid var(--gold);border-radius:0 10px 10px 0;background:#fffaf0}.advice-quote i{margin-top:.16rem;color:#a77717}.advice-quote p{margin:0}.advice-list{margin:.45rem 0;padding-left:1.25rem}.advice-list li{margin:.28rem 0;padding-left:.12rem}.advice-list li::marker{color:var(--red)}.advice-table-wrap{width:100%;margin:.65rem 0 1rem;overflow-x:auto;border:1px solid var(--border-mid);border-radius:12px;background:#fff;box-shadow:0 4px 15px rgba(36,24,26,.04);scrollbar-width:thin}.advice-table-wrap table{width:100%;min-width:610px;border-collapse:separate;border-spacing:0;table-layout:fixed}.advice-table-wrap th,.advice-table-wrap td{padding:.56rem .62rem;border-right:1px solid var(--border);border-bottom:1px solid var(--border);text-align:left;vertical-align:top;line-height:1.58}.advice-table-wrap th{position:sticky;top:0;z-index:1;color:#fff;background:#8f192f;font-size:.67rem;font-weight:650}.advice-table-wrap th:first-child{width:24%}.advice-table-wrap th:nth-child(2){width:13%}.advice-table-wrap th:nth-child(3){width:31%}.advice-table-wrap th:last-child{width:32%}.advice-table-wrap td{color:var(--ink-2);background:#fff;font-size:.66rem}.advice-table-wrap tr:nth-child(even) td{background:#fcfaf8}.advice-table-wrap th:last-child,.advice-table-wrap td:last-child{border-right:0}.advice-table-wrap tbody tr:last-child td{border-bottom:0}.advice-table-wrap td.cell-positive,.advice-table-wrap td.cell-caution,.advice-table-wrap td.cell-negative{font-weight:650}.advice-table-wrap td.cell-positive{color:#287044;background:#eef8f1}.advice-table-wrap td.cell-caution{color:#8a6418;background:#fff8e9}.advice-table-wrap td.cell-negative{color:#a4283d;background:#fff0f2}@media(max-width:700px){.advice-markdown{font-size:.76rem}.advice-table-wrap table{min-width:560px}}
</style>
