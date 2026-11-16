<script setup lang="ts">
const form = reactive({ name: '', description: '', password: '' })
const busy = ref(false); const error = ref('')
async function create() { busy.value = true; error.value = ''; try { const result = await $fetch('/api/groups', { method: 'POST', body: form }) as any; sessionStorage.setItem(`organizer_${result.group.id}`, result.adminToken); await navigateTo(`/g/${result.group.id}`) } catch (e: any) { error.value = e.data?.statusMessage || 'Could not create your group.' } finally { busy.value = false } }
</script>
<template>
  <main class="home">
    <section class="intro">
      <h1>Group decisions</h1>
      <p class="lede">Consensish lets groups review proposals, discuss changes, and record consensus decisions without everyone being online at once.</p>
      <ol class="steps">
        <li><strong>Create a group and proposal</strong><p>Add a description, budget, and facilitator. The budget and proposal type determine the review period.</p></li>
        <li><strong>Share the decision link</strong><p>Participants can state a position, ask questions, comment, or suggest changes. No account is required.</p></li>
        <li><strong>Record the outcome</strong><p>After review, the facilitator records whether the group agreed and why. Proposals, responses, and revisions stay in the group history.</p></li>
      </ol>
      <p class="note">Agreement requires at least one approval and no blocks. The facilitator records the outcome; proposals are not accepted automatically.</p>
    </section>
    <section class="panel start-panel">
      <h2>Create a group</h2>
      <p>Save the group link and the organizer key provided after creation. The key lets you restore organizer access in another browser.</p>
      <form @submit.prevent="create">
        <label>Group or organization name<input v-model="form.name" required maxlength="100" placeholder="e.g. Maple Street Collective"></label>
        <label>Group description <small>optional</small><textarea v-model="form.description" maxlength="1000" rows="3" /></label>
        <label>Group password <small>optional</small><input v-model="form.password" type="password" minlength="8" maxlength="200" autocomplete="new-password" placeholder="At least 8 characters"><span class="hint">Protects the group’s decision history. Individual decisions can have separate passwords.</span></label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="button full" :disabled="busy">{{ busy ? 'Creating…' : 'Create group' }}</button>
      </form>
      <p class="panel-foot">To open an existing group or decision, use its shared link.</p>
    </section>
  </main>
</template>
