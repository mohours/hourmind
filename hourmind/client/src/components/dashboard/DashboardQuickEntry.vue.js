/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
// 路由跳转
import { useRouter } from 'vue-router';
// 对话 store
import { useChatStore } from '@/stores/chatStore';
const router = useRouter(); // 路由实例
const chatStore = useChatStore(); // 对话状态
// 4 个快速入口定义
const entries = [
    { label: '新对话', icon: '💬', route: '/chat', disabled: false }, // 已实现
    { label: 'API Key', icon: '🔑', route: '/keys', disabled: false }, // 已实现
    { label: '知识库', icon: '📚', route: '/knowledge', disabled: true }, // 未实现
    { label: '待办事项', icon: '✅', route: '/tasks', disabled: true }, // 未实现
];
// 处理点击
async function handleClick(entry) {
    if (entry.disabled)
        return; // 未实现的功能不响应点击
    // 新对话需要先创建会话
    if (entry.route === '/chat') {
        await chatStore.createConversation();
    }
    router.push(entry.route); // 跳转路由
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['entry-disabled']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "quick-entry-row" },
});
for (const [entry] of __VLS_getVForSourceType((__VLS_ctx.entries))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.handleClick(entry);
            } },
        key: (entry.label),
        ...{ class: "glass-card entry-card" },
        ...{ class: ({ 'entry-disabled': entry.disabled }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "entry-icon" },
    });
    (entry.icon);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "entry-label" },
    });
    (entry.label);
    if (entry.disabled) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "entry-badge" },
        });
    }
}
/** @type {__VLS_StyleScopedClasses['quick-entry-row']} */ ;
/** @type {__VLS_StyleScopedClasses['glass-card']} */ ;
/** @type {__VLS_StyleScopedClasses['entry-card']} */ ;
/** @type {__VLS_StyleScopedClasses['entry-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['entry-label']} */ ;
/** @type {__VLS_StyleScopedClasses['entry-badge']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            entries: entries,
            handleClick: handleClick,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
