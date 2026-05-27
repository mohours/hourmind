/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/appStore';
const r = useRouter();
const a = useAppStore();
const pwd = ref('');
const pwd2 = ref('');
const err = ref('');
const ing = ref(false);
async function submit() {
    err.value = '';
    if (!pwd.value) {
        err.value = '请输入密码';
        return;
    }
    if (pwd.value.length < 4) {
        err.value = '密码至少4位';
        return;
    }
    if (pwd.value !== pwd2.value) {
        err.value = '两次密码不一致';
        return;
    }
    ing.value = true;
    try {
        await a.setup(pwd.value);
        r.push('/');
    }
    catch (e) {
        err.value = e.message || '设置失败';
    }
    finally {
        ing.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "auth-page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "glass-card auth-card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "auth-logo" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "auth-subtitle" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onKeydown: (__VLS_ctx.submit) },
    type: "password",
    placeholder: "密码（至少4位）",
    ...{ class: "auth-input" },
});
(__VLS_ctx.pwd);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onKeydown: (__VLS_ctx.submit) },
    type: "password",
    placeholder: "再次输入密码",
    ...{ class: "auth-input" },
});
(__VLS_ctx.pwd2);
if (__VLS_ctx.err) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-error" },
        ...{ style: {} },
    });
    (__VLS_ctx.err);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.submit) },
    ...{ class: "btn-primary auth-btn" },
    disabled: (__VLS_ctx.ing),
});
(__VLS_ctx.ing ? '设置中...' : '开始使用');
/** @type {__VLS_StyleScopedClasses['auth-page']} */ ;
/** @type {__VLS_StyleScopedClasses['glass-card']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-card']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-logo']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-input']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-input']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-btn']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            pwd: pwd,
            pwd2: pwd2,
            err: err,
            ing: ing,
            submit: submit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
