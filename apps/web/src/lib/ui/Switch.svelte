<!-- The look of an on/off choice: a lime track with the knob on the right when on, a grey one with
     the knob on the left when off. Only the look: the button around it carries the role and the
     state for screen readers. -->
<script lang="ts">
  interface Props {
    on: boolean;
  }

  let { on }: Props = $props();
</script>

<span class="switch" class:on aria-hidden="true"><span class="knob"></span></span>

<style>
  .switch {
    position: relative;
    display: inline-block;
    flex-shrink: 0;
    width: 2.6rem;
    height: 1.5rem;
    background: var(--control-line);
    border-radius: var(--radius-pill);
    transition: background 0.15s;
  }

  .switch.on {
    background: var(--signal);
    box-shadow: inset 0 0 0 1.5px var(--signal-deep);
  }

  .knob {
    position: absolute;
    top: 0.2rem;
    left: 0.2rem;
    width: 1.1rem;
    height: 1.1rem;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgb(0 0 0 / 35%);
    transition: transform 0.15s;
  }

  .on .knob {
    transform: translateX(1.1rem);
  }
</style>
