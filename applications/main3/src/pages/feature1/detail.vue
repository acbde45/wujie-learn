<template>
  <n-button @click="show = true">
    打开
  </n-button>
  <n-drawer v-model:show="show" :width="502">
    <n-drawer-content title="斯通纳" closable>
      《斯通纳》是美国作家约翰·威廉姆斯在 1965 年出版的小说。
    </n-drawer-content>
  </n-drawer>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { NButton, NDrawer, NDrawerContent } from 'naive-ui';

export default defineComponent({
  components: {
    NButton,
    NDrawer,
    NDrawerContent
  },
  setup () {
    return {
      show: ref(false)
    }
  }
})
</script>