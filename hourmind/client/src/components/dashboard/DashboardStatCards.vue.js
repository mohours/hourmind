/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
const props = defineProps();
// 定义 3 张统计卡片
const cards = [
    { label: '今日 Token', key: 'tokens_today' }, // 今日 Token 消耗
    { label: '今日对话', key: 'conversations_today' }, // 今日对话次数
    { label: '本月费用', key: 'cost_cents_month' }, // 本月费用（分）
];
// 格式化卡片数值
function formatValue(key) {
    // summary 为 null 时显示 0
    if (!props.summary)
        return '0';
    const usage = props.summary.usage; // 用量数据
    if (key === 'tokens_today') {
        // Token 数用千分位格式化（如 12,400）
        return usage.tokens_today.toLocaleString();
    }
    if (key === 'conversations_today') {
        // 对话次数直接显示数字
        return String(usage.conversations_today);
    }
    // 费用：从分转美元，保留 2 位小数
    return '$' + (usage.cost_cents_month / 100).toFixed(2);
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-row" },
});
for (const [card] of __VLS_getVForSourceType((__VLS_ctx.cards))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (card.key),
        ...{ class: "glass-card stat-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "stat-label" },
    });
    (card.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "stat-value" },
    });
    (__VLS_ctx.formatValue(card.key));
}
/** @type {__VLS_StyleScopedClasses['stat-row']} */ ;
/** @type {__VLS_StyleScopedClasses['glass-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            cards: cards,
            formatValue: formatValue,
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
