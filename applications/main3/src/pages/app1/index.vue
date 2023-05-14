<template>
  <wallworld-app width="100%" height="100%" name="app1" :url="url" :props="{ route, router }"></wallworld-app>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const url = computed(() => {
  const { path } = route.params;
  const appRoutePath = Array.isArray(path) ? path.join('/') : path;
  return `//localhost:7001/app1/${appRoutePath}`
});
</script>
