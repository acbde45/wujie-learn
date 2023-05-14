<template>
  <n-space>
    <router-link to="/main/feature1/detail">
      <n-button>详情</n-button>
    </router-link>
    <router-link to="/app1/feature1/list">
      <n-button>app1 列表</n-button>
    </router-link>
  </n-space>
</template>

<script setup lang="ts">
import { NButton, NSpace } from "naive-ui";
</script>
