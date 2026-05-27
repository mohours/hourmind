/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
// 计算属性 —— 从 Vue 导入
import { computed } from 'vue';
// 路由跳转
import { useRouter } from 'vue-router';
// 对话 store —— 用于创建新会话
import { useChatStore } from '@/stores/chatStore';
const router = useRouter(); // 路由实例
const chatStore = useChatStore(); // 对话状态
// 动态问候：根据当前小时切换文案
const greeting = computed(() => {
    const h = new Date().getHours(); // 当前小时（0-23）
    if (h < 6)
        return '夜深了，注意休息'; // 凌晨 0-5 点
    if (h < 12)
        return '早上好'; // 上午 6-11 点
    if (h < 14)
        return '中午好'; // 中午 12-13 点
    if (h < 18)
        return '下午好'; // 下午 14-17 点
    return '晚上好'; // 晚上 18-23 点
});
// 格式化日期：如 "2026年5月27日 星期三"
const dateStr = computed(() => {
    const d = new Date(); // 当前日期
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekDays[d.getDay()]}`;
});
// 点击"开始新对话" → 创建会话 → 跳转到聊天页
async function startNewChat() {
    await chatStore.createConversation(); // 后端创建 + 设为 activeId
    router.push('/chat'); // 跳转到对话页
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "welcome" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "welcome-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "greeting" },
});
(__VLS_ctx.greeting);
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "date" },
});
(__VLS_ctx.dateStr);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.startNewChat) },
    ...{ class: "btn-primary new-chat-btn" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    'stroke-width': "2",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.line)({
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.line)({
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12",
});
/** @type {__VLS_StyleScopedClasses['welcome']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-text']} */ ;
/** @type {__VLS_StyleScopedClasses['greeting']} */ ;
/** @type {__VLS_StyleScopedClasses['date']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['new-chat-btn']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            greeting: greeting,
            dateStr: dateStr,
            startNewChat: startNewChat,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
