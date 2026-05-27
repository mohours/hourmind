import { useChatStore } from '@/stores/chatStore';
const cs = useChatStore();
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['ci']} */ ;
/** @type {__VLS_StyleScopedClasses['ci']} */ ;
/** @type {__VLS_StyleScopedClasses['ci']} */ ;
/** @type {__VLS_StyleScopedClasses['cd']} */ ;
/** @type {__VLS_StyleScopedClasses['cd']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "csb" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.cs.createConversation();
        } },
    ...{ class: "btn-primary nb" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "cl" },
});
for (const [c] of __VLS_getVForSourceType((__VLS_ctx.cs.conversations))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.cs.selectConversation(c.id);
            } },
        key: (c.id),
        ...{ class: (['ci', { ac: c.id === __VLS_ctx.cs.activeId }]) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "cti" },
    });
    (c.title || '新对话');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.cs.deleteConversation(c.id);
            } },
        ...{ class: "cd" },
    });
}
if (__VLS_ctx.cs.conversations.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "ce text-muted" },
    });
}
/** @type {__VLS_StyleScopedClasses['csb']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['nb']} */ ;
/** @type {__VLS_StyleScopedClasses['cl']} */ ;
/** @type {__VLS_StyleScopedClasses['cti']} */ ;
/** @type {__VLS_StyleScopedClasses['cd']} */ ;
/** @type {__VLS_StyleScopedClasses['ce']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            cs: cs,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
