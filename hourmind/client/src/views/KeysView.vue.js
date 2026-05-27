/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted } from 'vue';
import { useKeyStore } from '@/stores/keyStore';
import KeyCard from '@/components/KeyCard.vue';
import AddKeyDialog from '@/components/AddKeyDialog.vue';
const ks = useKeyStore();
onMounted(() => { ks.fetchKeys(); ks.fetchStats(); });
function open() { ks.fetchProviders(); ks.showAddDialog = true; }
async function ht(id) { const r = await ks.testKey(id); alert(r.success ? `测试通过 ${r.latencyMs}ms` : `失败:${r.errorMessage}`); }
async function htg(id, on) { await ks.toggleKey(id, on); }
async function hd(id) { if (confirm('确定删除？'))
    await ks.deleteKey(id); }
function oc() { ks.showAddDialog = false; ks.fetchKeys(); ks.fetchStats(); }
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['kh']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "kp" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "kh" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.open) },
    ...{ class: "btn-primary" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sr" },
});
for (const [v, l, i] of __VLS_getVForSourceType(([{ l: '总数', k: 'total' }, { l: '活跃', k: 'active' }, { l: '月消耗', k: 'monthlyCost' }]))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "glass-card sc" },
        key: (i),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "sl" },
    });
    (v.l);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: (['sv', v.k === 'active' ? 'text-success' : '']) },
    });
    (v.k === 'monthlyCost' ? '$' + (__VLS_ctx.ks.stats[v.k] / 100).toFixed(2) : __VLS_ctx.ks.stats[v.k]);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "fr" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onInput: (...[$event]) => {
            __VLS_ctx.ks.fetchKeys();
        } },
    placeholder: "搜索...",
    ...{ class: "si" },
});
(__VLS_ctx.ks.search);
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    ...{ onChange: (...[$event]) => {
            __VLS_ctx.ks.fetchKeys();
        } },
    value: (__VLS_ctx.ks.statusFilter),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "all",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "active",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "disabled",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "error",
});
if (__VLS_ctx.ks.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "hint" },
    });
}
else if (__VLS_ctx.ks.filteredKeys.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "hint" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-muted" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "kg" },
    });
    for (const [k] of __VLS_getVForSourceType((__VLS_ctx.ks.filteredKeys))) {
        /** @type {[typeof KeyCard, ]} */ ;
        // @ts-ignore
        const __VLS_0 = __VLS_asFunctionalComponent(KeyCard, new KeyCard({
            ...{ 'onTest': {} },
            ...{ 'onToggle': {} },
            ...{ 'onDelete': {} },
            key: (k.id),
            ak: (k),
        }));
        const __VLS_1 = __VLS_0({
            ...{ 'onTest': {} },
            ...{ 'onToggle': {} },
            ...{ 'onDelete': {} },
            key: (k.id),
            ak: (k),
        }, ...__VLS_functionalComponentArgsRest(__VLS_0));
        let __VLS_3;
        let __VLS_4;
        let __VLS_5;
        const __VLS_6 = {
            onTest: (...[$event]) => {
                if (!!(__VLS_ctx.ks.loading))
                    return;
                if (!!(__VLS_ctx.ks.filteredKeys.length === 0))
                    return;
                __VLS_ctx.ht(k.id);
            }
        };
        const __VLS_7 = {
            onToggle: (...[$event]) => {
                if (!!(__VLS_ctx.ks.loading))
                    return;
                if (!!(__VLS_ctx.ks.filteredKeys.length === 0))
                    return;
                __VLS_ctx.htg(k.id, k.status !== 'active');
            }
        };
        const __VLS_8 = {
            onDelete: (...[$event]) => {
                if (!!(__VLS_ctx.ks.loading))
                    return;
                if (!!(__VLS_ctx.ks.filteredKeys.length === 0))
                    return;
                __VLS_ctx.hd(k.id);
            }
        };
        var __VLS_2;
    }
}
if (__VLS_ctx.ks.showAddDialog) {
    /** @type {[typeof AddKeyDialog, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(AddKeyDialog, new AddKeyDialog({
        ...{ 'onClose': {} },
        ...{ 'onCreated': {} },
    }));
    const __VLS_10 = __VLS_9({
        ...{ 'onClose': {} },
        ...{ 'onCreated': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    let __VLS_12;
    let __VLS_13;
    let __VLS_14;
    const __VLS_15 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.ks.showAddDialog))
                return;
            __VLS_ctx.ks.showAddDialog = false;
        }
    };
    const __VLS_16 = {
        onCreated: (__VLS_ctx.oc)
    };
    var __VLS_11;
}
/** @type {__VLS_StyleScopedClasses['kp']} */ ;
/** @type {__VLS_StyleScopedClasses['kh']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['sr']} */ ;
/** @type {__VLS_StyleScopedClasses['glass-card']} */ ;
/** @type {__VLS_StyleScopedClasses['sc']} */ ;
/** @type {__VLS_StyleScopedClasses['sl']} */ ;
/** @type {__VLS_StyleScopedClasses['fr']} */ ;
/** @type {__VLS_StyleScopedClasses['si']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted']} */ ;
/** @type {__VLS_StyleScopedClasses['kg']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            KeyCard: KeyCard,
            AddKeyDialog: AddKeyDialog,
            ks: ks,
            open: open,
            ht: ht,
            htg: htg,
            hd: hd,
            oc: oc,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
