// dashboardStore.ts —— 仪表盘首页数据状态管理
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { wsClient } from '@/composables/useWs';
export const useDashboardStore = defineStore('dashboard', () => {
    // 聚合数据
    const summary = ref(null);
    // 加载状态
    const loading = ref(false);
    // 拉取仪表盘数据
    async function fetchSummary() {
        loading.value = true;
        try {
            summary.value = await wsClient.send('dashboard.summary');
        }
        finally {
            loading.value = false;
        }
    }
    return { summary, loading, fetchSummary };
});
