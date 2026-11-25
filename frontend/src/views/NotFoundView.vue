<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <section>
    <h1>Page not found</h1>
    <p><RouterLink :to="{ name: 'dashboard' }">Back to the dashboard</RouterLink></p>
  </section>
</template>
