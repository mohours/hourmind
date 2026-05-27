/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
// ==================== 导入 ====================
import { computed, onMounted, ref, nextTick } from 'vue';
import { useChatStore } from '@/stores/chatStore';
import { wsClient } from '@/composables/useWs';
import ChatMessageList from '@/components/ChatMessageList.vue';
// ==================== 初始化 ====================
const cs = useChatStore();
onMounted(() => cs.fetchConversations());
// ==================== 模型列表 ====================
const models = [
    'deepseek-v4-pro',
    'deepseek-v4-flash',
    'gpt-4o',
    'gpt-4o-mini',
    'claude-3-5-sonnet-20241022',
    'claude-3-haiku-20240307',
    'gemini-2.0-flash',
    'grok-2',
];
// ==================== 标题 ====================
const ti = computed(() => {
    if (!cs.activeId)
        return '报数系统';
    const c = cs.conversations.find(x => x.id === cs.activeId);
    return c?.title || '新对话';
});
// ==================== 重命名功能 ====================
const renaming = ref(false);
const newTitle = ref('');
const ri = ref(null);
function startRename() {
    if (!cs.activeId)
        return;
    renaming.value = true;
    newTitle.value = ti.value;
    nextTick(() => ri.value?.focus());
}
async function saveRename() {
    renaming.value = false;
    const title = newTitle.value.trim();
    if (!title || !cs.activeId || title === ti.value)
        return;
    await wsClient.send('conversations.update', {
        conversationId: cs.activeId,
        title,
    });
    cs.fetchConversations();
}
// ==================== 输入和发送 ====================
const inputText = ref('');
const inputRef = ref(null);
function sendMessage() {
    const content = inputText.value.trim();
    if (!content || cs.isStreaming)
        return;
    cs.sendMessage(content);
    inputText.value = '';
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['title']} */ ;
/** @type {__VLS_StyleScopedClasses['header-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['header-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['model-select']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-logo']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['input-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['message-input']} */ ;
/** @type {__VLS_StyleScopedClasses['message-input']} */ ;
/** @type {__VLS_StyleScopedClasses['send-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['send-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['send-btn']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "chat-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "chat-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-left" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "logo" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
    ...{ class: "logo-icon" },
    viewBox: "0 0 24 24",
    fill: "none",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
    d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "logo-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-center" },
});
if (!__VLS_ctx.renaming) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ onDblclick: (__VLS_ctx.startRename) },
        ...{ class: "title" },
    });
    (__VLS_ctx.ti);
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onBlur: (__VLS_ctx.saveRename) },
        ...{ onKeydown: (__VLS_ctx.saveRename) },
        ref: "ri",
        ...{ class: "title-input" },
    });
    (__VLS_ctx.newTitle);
    /** @type {typeof __VLS_ctx.ri} */ ;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "user-info" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "user-avatar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
    viewBox: "0 0 24 24",
    fill: "none",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.circle)({
    cx: "12",
    cy: "8",
    r: "4",
    stroke: "currentColor",
    'stroke-width': "2",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
    d: "M4 20c0-4 4-6 8-6s8 2 8 6",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "user-name" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ class: "header-btn" },
    title: "关闭",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
    viewBox: "0 0 24 24",
    fill: "none",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
    d: "M18 6L6 18M6 6l12 12",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ class: "header-btn" },
    title: "通知",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
    viewBox: "0 0 24 24",
    fill: "none",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
    d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
    d: "M13.73 21a2 2 0 0 1-3.46 0",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sub-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "subtitle" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "model-select-wrapper" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.cs.currentModel),
    ...{ class: "model-select" },
});
for (const [m] of __VLS_getVForSourceType((__VLS_ctx.models))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (m),
        value: (m),
    });
    (m);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
    ...{ class: "select-arrow" },
    viewBox: "0 0 24 24",
    fill: "none",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
    d: "M6 9l6 6 6-6",
    stroke: "currentColor",
    'stroke-width': "2",
    'stroke-linecap': "round",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "messages-container" },
});
if (__VLS_ctx.cs.activeId) {
    /** @type {[typeof ChatMessageList, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(ChatMessageList, new ChatMessageList({
        ...{ 'onRegenerate': {} },
    }));
    const __VLS_1 = __VLS_0({
        ...{ 'onRegenerate': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    let __VLS_3;
    let __VLS_4;
    let __VLS_5;
    const __VLS_6 = {
        onRegenerate: (...[$event]) => {
            if (!(__VLS_ctx.cs.activeId))
                return;
            __VLS_ctx.cs.regenerateLast();
        }
    };
    var __VLS_2;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "welcome-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "welcome-logo" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
        viewBox: "0 0 24 24",
        fill: "none",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
        stroke: "url(#gradient)",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.defs, __VLS_intrinsicElements.defs)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.linearGradient, __VLS_intrinsicElements.linearGradient)({
        id: "gradient",
        x1: "3",
        y1: "2",
        x2: "21",
        y2: "22",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.stop)({
        'stop-color': "#00E5D8",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.stop)({
        offset: "1",
        'stop-color': "#6366F1",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
        ...{ class: "welcome-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "welcome-desc" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.cs.activeId))
                    return;
                __VLS_ctx.cs.createConversation();
            } },
        ...{ class: "btn-primary welcome-btn" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
        viewBox: "0 0 24 24",
        fill: "none",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        d: "M12 5v14M5 12h14",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
    });
}
if (__VLS_ctx.cs.activeId) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "input-container" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "input-wrapper" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "input-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ class: "action-btn" },
        title: "添加图片",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
        viewBox: "0 0 24 24",
        fill: "none",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.rect)({
        x: "3",
        y: "3",
        width: "18",
        height: "18",
        rx: "2",
        stroke: "currentColor",
        'stroke-width': "2",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.circle)({
        cx: "8.5",
        cy: "8.5",
        r: "1.5",
        fill: "currentColor",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        d: "M21 15l-5-5L5 21",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ class: "action-btn" },
        title: "上传文件",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
        viewBox: "0 0 24 24",
        fill: "none",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.polyline)({
        points: "17,8 12,3 7,8",
        stroke: "currentColor",
        'stroke-width': "2",
        fill: "none",
        'stroke-linecap': "round",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.line)({
        x1: "12",
        y1: "3",
        x2: "12",
        y2: "15",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ class: "action-btn" },
        title: "快捷指令",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
        viewBox: "0 0 24 24",
        fill: "none",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        d: "M4 7V4h3M4 17v3h3M20 7V4h-3M20 17v3h-3M9 9h6v6H9z",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ class: "action-btn" },
        title: "语音输入",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
        viewBox: "0 0 24 24",
        fill: "none",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        d: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z",
        stroke: "currentColor",
        'stroke-width': "2",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        d: "M19 10v2a7 7 0 0 1-14 0v-2",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.line)({
        x1: "12",
        y1: "19",
        x2: "12",
        y2: "23",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.line)({
        x1: "8",
        y1: "23",
        x2: "16",
        y2: "23",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onKeydown: (__VLS_ctx.sendMessage) },
        ref: "inputRef",
        value: (__VLS_ctx.inputText),
        type: "text",
        ...{ class: "message-input" },
        placeholder: "输入消息...",
        disabled: (__VLS_ctx.cs.isStreaming),
    });
    /** @type {typeof __VLS_ctx.inputRef} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "input-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "premium-badge" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.sendMessage) },
        ...{ class: "send-btn" },
        disabled: (!__VLS_ctx.inputText.trim() || __VLS_ctx.cs.isStreaming),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
        viewBox: "0 0 24 24",
        fill: "none",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        d: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ class: "action-btn expand-btn" },
        title: "展开",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
        viewBox: "0 0 24 24",
        fill: "none",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        d: "M9 18l6-6-6-6",
        stroke: "currentColor",
        'stroke-width': "2",
        'stroke-linecap': "round",
    });
}
/** @type {__VLS_StyleScopedClasses['chat-container']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-left']} */ ;
/** @type {__VLS_StyleScopedClasses['logo']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-text']} */ ;
/** @type {__VLS_StyleScopedClasses['header-center']} */ ;
/** @type {__VLS_StyleScopedClasses['title']} */ ;
/** @type {__VLS_StyleScopedClasses['title-input']} */ ;
/** @type {__VLS_StyleScopedClasses['header-right']} */ ;
/** @type {__VLS_StyleScopedClasses['user-info']} */ ;
/** @type {__VLS_StyleScopedClasses['user-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['user-name']} */ ;
/** @type {__VLS_StyleScopedClasses['header-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['header-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-header']} */ ;
/** @type {__VLS_StyleScopedClasses['subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['model-select-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['model-select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['messages-container']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-page']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-logo']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-title']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['input-container']} */ ;
/** @type {__VLS_StyleScopedClasses['input-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['input-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['message-input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-right']} */ ;
/** @type {__VLS_StyleScopedClasses['premium-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['send-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['expand-btn']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ChatMessageList: ChatMessageList,
            cs: cs,
            models: models,
            ti: ti,
            renaming: renaming,
            newTitle: newTitle,
            ri: ri,
            startRename: startRename,
            saveRename: saveRename,
            inputText: inputText,
            inputRef: inputRef,
            sendMessage: sendMessage,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
