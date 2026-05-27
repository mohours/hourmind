// keyStore.ts —— API Key 管理状态
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { wsClient } from '@/composables/useWs';
export const useKeyStore = defineStore('keys', () => {
    const keys = ref([]);
    const loading = ref(false);
    const search = ref('');
    const statusFilter = ref('all');
    const stats = ref({ total: 0, active: 0, monthlyCost: 0 });
    const showAddDialog = ref(false);
    const providers = ref([]);
    const filteredKeys = computed(() => {
        let result = keys.value;
        if (statusFilter.value !== 'all')
            result = result.filter(k => k.status === statusFilter.value);
        if (search.value) {
            const kw = search.value.toLowerCase();
            result = result.filter(k => k.alias.toLowerCase().includes(kw) || k.provider.name.toLowerCase().includes(kw));
        }
        return result;
    });
    async function fetchKeys() { loading.value = true; try {
        keys.value = await wsClient.send('keys.list');
    }
    finally {
        loading.value = false;
    } }
    async function fetchStats() { stats.value = await wsClient.send('keys.stats'); }
    async function fetchProviders() { providers.value = await wsClient.send('providers.list'); }
    async function createKey(d) { const r = await wsClient.send('keys.create', d); keys.value.unshift(r); await fetchStats(); }
    async function testKey(id) { const r = await wsClient.send('keys.test', { keyId: id }); const k = keys.value.find(x => x.id === id); if (k)
        k.status = r.success ? 'active' : 'error'; return r; }
    async function deleteKey(id) { await wsClient.send('keys.delete', { keyId: id }); keys.value = keys.value.filter(x => x.id !== id); await fetchStats(); }
    async function toggleKey(id, on) { await wsClient.send('keys.toggle', { keyId: id, enabled: on }); const k = keys.value.find(x => x.id === id); if (k)
        k.status = on ? 'active' : 'disabled'; }
    return { keys, loading, search, statusFilter, stats, showAddDialog, providers, filteredKeys, fetchKeys, fetchStats, fetchProviders, createKey, testKey, deleteKey, toggleKey };
});
