<template>
  <n-space vertical>
    <n-input placeholder="请输入" />
    <n-space>
      <router-link :to="'/feature1/detail'">
        <n-button>详情</n-button>
      </router-link>
      <n-button @click="jumpToMainFeature1Detail">main feature1 详情</n-button>
    </n-space>
  </n-space>
</template>

<script setup lang="ts">
import { NButton, NInput, NSpace } from "naive-ui";

function jumpToMainFeature1Detail() {
  const mainRouter = window?.$wujie?.props?.router;
  if (mainRouter) {
    mainRouter.push("/main/feature1/detail");
  }
}
</script>
