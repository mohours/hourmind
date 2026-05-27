/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
// 页面挂载时加载数据
import { onMounted } from 'vue';
// 仪表盘数据 store
import { useDashboardStore } from '@/stores/dashboardStore';
// 子组件
import DashboardWelcome from '@/components/dashboard/DashboardWelcome.vue';
import DashboardStatCards from '@/components/dashboard/DashboardStatCards.vue';
import DashboardQuickEntry from '@/components/dashboard/DashboardQuickEntry.vue';
import DashboardRecentConversations from '@/components/dashboard/DashboardRecentConversations.vue';
const ds = useDashboardStore(); // 仪表盘 store 实例
// 页面挂载后拉取仪表盘数据
onMounted(() => {
    ds.fetchSummary(); // 发送 dashboard.summary 请求
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "dashboard" },
});
/** @type {[typeof DashboardWelcome, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(DashboardWelcome, new DashboardWelcome({}));
const __VLS_1 = __VLS_0({}, ...__VLS_functionalComponentArgsRest(__VLS_0));
if (__VLS_ctx.ds.loading && !__VLS_ctx.ds.summary) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading-hint text-muted" },
    });
}
else {
    /** @type {[typeof DashboardStatCards, ]} */ ;
    // @ts-ignore
    const __VLS_3 = __VLS_asFunctionalComponent(DashboardStatCards, new DashboardStatCards({
        summary: (__VLS_ctx.ds.summary),
    }));
    const __VLS_4 = __VLS_3({
        summary: (__VLS_ctx.ds.summary),
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
    /** @type {[typeof DashboardQuickEntry, ]} */ ;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent(DashboardQuickEntry, new DashboardQuickEntry({}));
    const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
    /** @type {[typeof DashboardRecentConversations, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(DashboardRecentConversations, new DashboardRecentConversations({
        conversations: (__VLS_ctx.ds.summary?.recent_conversations || []),
        loading: (false),
    }));
    const __VLS_10 = __VLS_9({
        conversations: (__VLS_ctx.ds.summary?.recent_conversations || []),
        loading: (false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
}
/** @type {__VLS_StyleScopedClasses['dashboard']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            DashboardWelcome: DashboardWelcome,
            DashboardStatCards: DashboardStatCards,
            DashboardQuickEntry: DashboardQuickEntry,
            DashboardRecentConversations: DashboardRecentConversations,
            ds: ds,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
