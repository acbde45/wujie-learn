<template>
  <n-config-provider>
    <n-global-style />
    <router-view v-slot="{ Component, route }">
      <keep-alive>
        <component :key="route.fullPath" :is="Component" />
      </keep-alive>
    </router-view>
  </n-config-provider>
</template>

<script setup lang="ts">
import { NConfigProvider, NGlobalStyle } from "naive-ui";
</script>

<style scoped></style>
