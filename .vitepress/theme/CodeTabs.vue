<script setup>
import { computed, ref, watch } from "vue";
import CodeBlock from "./CodeBlock.vue";

const props = defineProps({
  title:      { type: String, default: "Examples" },
  subtitle:   { type: String, default: "" },
  examples:   { type: Array,  required: true },
  defaultKey: { type: String, default: "" },
});

const active = ref(props.defaultKey || (props.examples?.[0]?.key ?? ""));

watch(
  () => [props.defaultKey, props.examples?.map(e => e.key).join("|")].join("::"),
  () => {
    const wanted = props.defaultKey || active.value;
    const exists = props.examples?.some(e => e.key === wanted);
    active.value = exists ? wanted : (props.examples?.[0]?.key ?? "");
  },
  { immediate: true }
);

const current = computed(() =>
  props.examples.find(e => e.key === active.value) || props.examples[0] || null
);

function setTab(key) { active.value = key; }

function onTabsKeydown(e) {
  const keys = props.examples?.map(x => x.key) ?? [];
  if (!keys.length) return;
  const idx = Math.max(0, keys.indexOf(active.value));
  let next = idx;
  if (e.key === "ArrowRight") next = (idx + 1) % keys.length;
  else if (e.key === "ArrowLeft") next = (idx - 1 + keys.length) % keys.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = keys.length - 1;
  else return;
  e.preventDefault();
  active.value = keys[next];
  e.currentTarget?.querySelector?.(`button[data-key="${active.value}"]`)?.focus?.();
}
</script>

<template>
  <div class="ct">
    <!-- Header -->
    <div class="ct-head">
      <div class="ct-meta">
        <div class="ct-title">{{ title }}</div>
        <div v-if="subtitle" class="ct-sub">{{ subtitle }}</div>
      </div>

      <div class="ct-tabs" role="tablist" aria-label="Code examples" @keydown="onTabsKeydown">
        <button
          v-for="ex in examples"
          :key="ex.key"
          class="ct-tab"
          :class="{ 'ct-tab--active': ex.key === active }"
          :aria-selected="ex.key === active"
          :tabindex="ex.key === active ? 0 : -1"
          role="tab"
          type="button"
          :data-key="ex.key"
          @click="setTab(ex.key)"
        >{{ ex.label }}</button>
      </div>
    </div>

    <!-- File badge -->
    <div class="ct-body">
      <div class="ct-file" v-if="current?.file">
        <span class="ct-lang-badge">{{ current.lang || "txt" }}</span>
        <span class="ct-filename">{{ current.file }}</span>
      </div>

      <CodeBlock
        :title="current?.title || current?.file || current?.label || ''"
        :lang="current?.lang || ''"
        :chips="Array.isArray(current?.chips) ? current.chips : []"
        :code="current?.code || ''"
        :run="current?.run || ''"
        :out="current?.out || ''"
        :note="current?.note || ''"
        :maxHeight="440"
      />
    </div>
  </div>
</template>

<style scoped>
.ct {
  border-radius: 12px; overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

/* Head */
.ct-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}

.ct-title {
  font-size: 13.5px; font-weight: 800;
  color: var(--vp-c-text-1); line-height: 1.2;
}

.ct-sub {
  margin-top: 2px; font-size: 12px;
  color: var(--vp-c-text-2); line-height: 1.4;
}

/* Tabs */
.ct-tabs {
  display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;
}

.ct-tab {
  border: 1px solid var(--vp-c-divider);
  background: transparent; color: var(--vp-c-text-2);
  padding: 5px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600; cursor: pointer; outline: none;
  transition: border-color .12s, background .12s, color .12s;
}
.ct-tab:hover { color: var(--vp-c-text-1); border-color: rgba(34,197,94,.30); }
.ct-tab--active {
  color: #22c55e; background: rgba(34,197,94,.10);
  border-color: rgba(34,197,94,.30);
}
.ct-tab:focus-visible { box-shadow: 0 0 0 2px rgba(34,197,94,.35); }

/* Body */
.ct-body { padding: 10px 10px 12px; }

/* File info */
.ct-file {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; margin-bottom: 8px;
  border: 1px dashed var(--vp-c-divider); border-radius: 9px;
  background: var(--vp-c-bg); color: var(--vp-c-text-2); font-size: 12.5px;
}

.ct-lang-badge {
  font-weight: 800; text-transform: uppercase; font-size: 10px;
  padding: 2px 7px; border-radius: 999px;
  border: 1px solid rgba(34,197,94,.25);
  background: rgba(34,197,94,.08); color: #22c55e;
}

.ct-filename {
  font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12.5px;
  color: var(--vp-c-text-1);
}

/* Responsive */
@media (max-width: 640px) {
  .ct-head { flex-direction: column; align-items: flex-start; gap: 8px; }
  .ct-tabs { justify-content: flex-start; }
}
</style>
