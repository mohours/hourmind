/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref } from 'vue';
import { useKeyStore } from '@/stores/keyStore';
const emit = defineEmits();
const ks = useKeyStore();
const pid = ref('');
const kv = ref('');
const al = ref('');
const er = ref('');
const sb = ref(false);
async function sub() {
    er.value = '';
    if (!pid.value) {
        er.value = '请选择厂商';
        return;
    }
    if (!kv.value.trim()) {
        er.value = '请输入Key';
        return;
    }
    sb.value = true;
    try {
        await ks.createKey({ providerId: pid.value, keyValue: kv.value.trim(), alias: al.value.trim() || undefined });
        emit('created');
    }
    catch (e) {
        er.value = e.message || '添加失败';
    }
    finally {
        sb.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['bc']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
        } },
    ...{ class: "dm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "glass-card db" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "lbl" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.pid),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "",
    disabled: true,
});
for (const [p] of __VLS_getVForSourceType((__VLS_ctx.ks.providers))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (p.id),
        value: (p.id),
    });
    (p.name);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "lbl" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "password",
    placeholder: "粘贴 Key...",
});
(__VLS_ctx.kv);
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "lbl" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    placeholder: "例如：主力Key",
});
(__VLS_ctx.al);
if (__VLS_ctx.er) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-error" },
        ...{ style: {} },
    });
    (__VLS_ctx.er);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "bt" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
        } },
    ...{ class: "bc" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.sub) },
    ...{ class: "btn-primary" },
    disabled: (__VLS_ctx.sb),
});
(__VLS_ctx.sb ? '添加中...' : '确认');
/** @type {__VLS_StyleScopedClasses['dm']} */ ;
/** @type {__VLS_StyleScopedClasses['glass-card']} */ ;
/** @type {__VLS_StyleScopedClasses['db']} */ ;
/** @type {__VLS_StyleScopedClasses['lbl']} */ ;
/** @type {__VLS_StyleScopedClasses['lbl']} */ ;
/** @type {__VLS_StyleScopedClasses['lbl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['bt']} */ ;
/** @type {__VLS_StyleScopedClasses['bc']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ks: ks,
            pid: pid,
            kv: kv,
            al: al,
            er: er,
            sb: sb,
            sub: sub,
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
