<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import HeroSearch from '../components/HeroSearch.vue'
import FeaturedProperties from '../components/FeaturedProperties.vue'
import ServicesBand from '../components/ServicesBand.vue'
import SellCta from '../components/SellCta.vue'
import AboutStats from '../components/AboutStats.vue'
import ContactForm from '../components/ContactForm.vue'
import AppFooter from '../components/AppFooter.vue'
</script>

<template>
  <AppHeader />
  <main>
    <HeroSearch />
    <FeaturedProperties />
    <ServicesBand />
    <SellCta />
    <AboutStats />
    <ContactForm />
  </main>
  <AppFooter />
</template>
