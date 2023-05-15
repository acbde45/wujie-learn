<template>
  <n-space vertical>
    <n-input placeholder="请输入" />
    <n-space>
      <router-link :to="app1DetailRoutePath">
        <n-button>详情</n-button>
      </router-link>
      <n-button @click="jumpToMainFeature1Detail">main feature1 详情</n-button>
    </n-space>
  </n-space>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated } from "vue";
import { NButton, NInput, NSpace } from "naive-ui";

const app1DetailRoutePath = window.__POWERED_BY_WALLWORLD__ ? "/app1/feature1/detail" : "/feature1/detail";

onActivated(() => {
  console.log("activated");
});

onDeactivated(() => {
  console.log("deactivated");
});

function jumpToMainFeature1Detail() {
  const mainRouter = window?.$wujie?.props?.router;
  if (mainRouter) {
    mainRouter.push("/main/feature1/detail");
  }
}
</script>
