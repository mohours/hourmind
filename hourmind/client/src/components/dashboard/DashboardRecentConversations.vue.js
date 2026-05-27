/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
// 路由跳转
import { useRouter } from 'vue-router';
// 对话 store —— 点击卡片后需要选中会话
import { useChatStore } from '@/stores/chatStore';
const router = useRouter(); // 路由实例
const chatStore = useChatStore(); // 对话状态
const __VLS_props = defineProps();
// 格式化相对时间
function formatTime(dateStr) {
    const now = Date.now(); // 当前时间戳
    const then = new Date(dateStr).getTime(); // 会话更新时间戳
    const diff = Math.floor((now - then) / 1000); // 相差秒数
    if (diff < 60)
        return '刚刚'; // 不到 1 分钟
    if (diff < 3600)
        return `${Math.floor(diff / 60)} 分钟前`; // 不到 1 小时
    if (diff < 86400)
        return `${Math.floor(diff / 3600)} 小时前`; // 不到 1 天
    if (diff < 604800)
        return `${Math.floor(diff / 86400)} 天前`; // 不到 1 周
    // 超过一周显示日期
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}
// 点击对话卡片 → 选中会话 → 跳转聊天页
async function goToChat(id) {
    await chatStore.selectConversation(id); // 加载消息历史
    router.push('/chat'); // 跳转
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "recent-section" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "section-title" },
});
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "recent-row" },
    });
    for (const [i] of __VLS_getVForSourceType((3))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (i),
            ...{ class: "glass-card skeleton-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "skeleton-line skeleton-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "skeleton-line skeleton-sub" },
        });
    }
}
else if (!__VLS_ctx.conversations || __VLS_ctx.conversations.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty-state" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-muted" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-muted" },
        ...{ style: {} },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "recent-row" },
    });
    for (const [conv] of __VLS_getVForSourceType((__VLS_ctx.conversations))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(!__VLS_ctx.conversations || __VLS_ctx.conversations.length === 0))
                        return;
                    __VLS_ctx.goToChat(conv.id);
                } },
            key: (conv.id),
            ...{ class: "glass-card conv-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
            ...{ class: "conv-title" },
        });
        (conv.title);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "conv-meta" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "conv-model" },
        });
        (conv.model);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "conv-count" },
        });
        (conv.messageCount);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "conv-time" },
        });
        (__VLS_ctx.formatTime(conv.updatedAt));
    }
}
/** @type {__VLS_StyleScopedClasses['recent-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['recent-row']} */ ;
/** @type {__VLS_StyleScopedClasses['glass-card']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-card']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-title']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted']} */ ;
/** @type {__VLS_StyleScopedClasses['recent-row']} */ ;
/** @type {__VLS_StyleScopedClasses['glass-card']} */ ;
/** @type {__VLS_StyleScopedClasses['conv-card']} */ ;
/** @type {__VLS_StyleScopedClasses['conv-title']} */ ;
/** @type {__VLS_StyleScopedClasses['conv-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['conv-model']} */ ;
/** @type {__VLS_StyleScopedClasses['conv-count']} */ ;
/** @type {__VLS_StyleScopedClasses['conv-time']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            formatTime: formatTime,
            goToChat: goToChat,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
