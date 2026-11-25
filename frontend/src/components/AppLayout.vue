<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import { NAV_ITEMS } from "@/router/routes";
</script>

<template>
  <div class="app">
    <header class="app-header">
      <span class="app-title">FinanceAI</span>
      <nav aria-label="Main">
        <ul class="nav-list">
          <li v-for="item in NAV_ITEMS" :key="item.name">
            <RouterLink :to="{ name: item.name }" exact-active-class="active">
              {{ item.label }}
            </RouterLink>
          </li>
        </ul>
      </nav>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>
