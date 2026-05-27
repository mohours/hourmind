/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
// ==================== 导入 ====================
import { useChatStore } from '@/stores/chatStore';
import ChatMessage from '@/components/ChatMessage.vue';
// ==================== Store ====================
const cs = useChatStore();
const emit = defineEmits();
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['messages-list']} */ ;
/** @type {__VLS_StyleScopedClasses['messages-list']} */ ;
/** @type {__VLS_StyleScopedClasses['messages-list']} */ ;
/** @type {__VLS_StyleScopedClasses['messages-list']} */ ;
/** @type {__VLS_StyleScopedClasses['streaming-dots']} */ ;
/** @type {__VLS_StyleScopedClasses['streaming-dots']} */ ;
/** @type {__VLS_StyleScopedClasses['streaming-dots']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    id: "chat-messages",
    ...{ class: "messages-list" },
});
for (const [m] of __VLS_getVForSourceType((__VLS_ctx.cs.messages))) {
    /** @type {[typeof ChatMessage, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(ChatMessage, new ChatMessage({
        ...{ 'onRegenerate': {} },
        key: (m.id),
        msg: (m),
        isStreaming: (__VLS_ctx.cs.isStreaming),
    }));
    const __VLS_1 = __VLS_0({
        ...{ 'onRegenerate': {} },
        key: (m.id),
        msg: (m),
        isStreaming: (__VLS_ctx.cs.isStreaming),
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    let __VLS_3;
    let __VLS_4;
    let __VLS_5;
    const __VLS_6 = {
        onRegenerate: (...[$event]) => {
            __VLS_ctx.emit('regenerate');
        }
    };
    var __VLS_2;
}
if (__VLS_ctx.cs.isStreaming) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "streaming-indicator" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "streaming-dots" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "streaming-text" },
    });
}
/** @type {__VLS_StyleScopedClasses['messages-list']} */ ;
/** @type {__VLS_StyleScopedClasses['streaming-indicator']} */ ;
/** @type {__VLS_StyleScopedClasses['streaming-dots']} */ ;
/** @type {__VLS_StyleScopedClasses['streaming-text']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ChatMessage: ChatMessage,
            cs: cs,
            emit: emit,
        };
    },
    __typeEmits: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
});
; /* PartiallyEnd: #4569/main.vue */
