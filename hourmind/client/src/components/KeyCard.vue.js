/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { computed } from 'vue';
const p = defineProps();
const __VLS_emit = defineEmits();
const dc = computed(() => ({ active: 'dg', disabled: 'dd', error: 'de' }[p.ak.status] || 'dd'));
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['ab']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "glass-card kc" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "ki" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "kp" },
});
(__VLS_ctx.ak.provider.name);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "ka" },
});
(__VLS_ctx.ak.alias);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-muted" },
    ...{ style: {} },
});
(__VLS_ctx.ak.keySuffix);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "ks" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: (['d', __VLS_ctx.dc]) },
});
(__VLS_ctx.ak.status);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "act" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('test');
        } },
    ...{ class: "ab" },
    title: "测试",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('toggle');
        } },
    ...{ class: "ab" },
    title: (__VLS_ctx.ak.status === 'active' ? '禁用' : '启用'),
});
(__VLS_ctx.ak.status === 'active' ? '⏸' : '▶');
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('delete');
        } },
    ...{ class: "ab db" },
    title: "删除",
});
/** @type {__VLS_StyleScopedClasses['glass-card']} */ ;
/** @type {__VLS_StyleScopedClasses['kc']} */ ;
/** @type {__VLS_StyleScopedClasses['ki']} */ ;
/** @type {__VLS_StyleScopedClasses['kp']} */ ;
/** @type {__VLS_StyleScopedClasses['ka']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted']} */ ;
/** @type {__VLS_StyleScopedClasses['ks']} */ ;
/** @type {__VLS_StyleScopedClasses['act']} */ ;
/** @type {__VLS_StyleScopedClasses['ab']} */ ;
/** @type {__VLS_StyleScopedClasses['ab']} */ ;
/** @type {__VLS_StyleScopedClasses['ab']} */ ;
/** @type {__VLS_StyleScopedClasses['db']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            dc: dc,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
