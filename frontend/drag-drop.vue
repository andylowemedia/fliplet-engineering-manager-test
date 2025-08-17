<template>
  <div>
    <!-- Page heading -->
    <h3>Drag & Drop Components</h3>

    <!--
      COMPONENT LIBRARY:
      Buttons here are the draggable "components" users can drag into the preview.
      - draggable="true" makes the element draggable by the browser.
      - @dragstart passes the native event ($event) and a component type string.
    -->
    <div class="library">
      <!-- Drag a "Text" component -->
      <button
          draggable="true"
          @dragstart="dragStart($event, 'Text')"
      >
        Text
      </button>

      <!-- Drag a "Button" component -->
      <button
          draggable="true"
          @dragstart="dragStart($event, 'Button')"
      >
        Button
      </button>
    </div>

    <!--
      PAGE PREVIEW:
      - @dragover.prevent prevents the browser's default handling so drop() will be called.
      - @drop calls our drop() method whenever something is dropped into this area.
    -->
    <div class="preview" @drop="drop" @dragover.prevent>
      <!--
        We render every dropped item with a dynamic component:
        - v-for iterates over items (our "page" components).
        - :is="getComponent(item.type)" chooses which HTML tag or Vue component to render.
        - :key is required to help Vue track list items properly.
        - v-bind="item.props.attrs" spreads attributes (class, id, etc.) onto the element.
        - The element's inner content uses the default slot — here we render item.props.text.
      -->
      <component
          v-for="(item, index) in items"
          :is="getComponent(item.type)"
          :key="item.id"
          v-bind="item.props.attrs"
      >
        {{ item.props.text }}
      </component>
    </div>
  </div>
</template>

<script>
export default {
  // `data()` returns the reactive state for this component.
  data() {
    return {
      // `items` holds the list of components dropped into the preview.
      // Each item is an object like:
      // { id: 'unique-id', type: 'Text'|'Button', props: { text: '...', attrs: { class: '...' } } }
      items: [],
    };
  },

  methods: {
    /**
     * dragStart(event, type)
     * Called when the user starts dragging a library item.
     * - We store the component type in the dataTransfer so the drop handler can read it.
     */
    dragStart(event, type) {
      // It's common to set 'text/plain' for maximum compatibility.
      // Also set a custom key (componentType) in case you prefer that later.
      event.dataTransfer.setData("componentType", type);
      event.dataTransfer.setData("text/plain", type);

      // Let the browser know what effect the drag should have (optional).
      // 'copy' indicates we intend to copy (not move) the component into the preview.
      event.dataTransfer.effectAllowed = "copy";
    },

    /**
     * drop(event)
     * Called when something is dropped into the preview area.
     * We read the component type from dataTransfer and add a new item to `this.items`.
     */
    drop(event) {
      // (defensive) prevent default handling — though @dragover.prevent already helps.
      event.preventDefault();

      // Try to read our custom key first, fallback to 'text/plain'.
      const type =
          event.dataTransfer.getData("componentType") ||
          event.dataTransfer.getData("text/plain");

      // If there's a valid type, create a new item and push it into the reactive array.
      if (type) {
        this.items.push({
          // Simple unique id: timestamp + random. Good enough for UI keys.
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type,
          // Default props (text + attributes) for this component type.
          props: this.getDefaultProps(type),
        });
      }
    },

    /**
     * getComponent(type)
     * Maps a type string (from drag) to a component or HTML tag name.
     * - You can change values to registered Vue components (e.g. 'MyText' or a component object).
     * - For now we use basic HTML tags ('p' and 'button') for simplicity.
     */
    getComponent(type) {
      const map = {
        Text: "p",     // render a <p> element for Text
        Button: "button", // render a <button> element for Button
      };
      // default to 'div' if type isn't recognized — prevents errors.
      return map[type] || "div";
    },

    /**
     * getDefaultProps(type)
     * Returns the default content and attributes for a newly dropped item of `type`.
     * - `text`: the inner text (rendered inside the element).
     * - `attrs`: a plain object of attributes to spread onto the element using v-bind.
     */
    getDefaultProps(type) {
      if (type === "Text") {
        return {
          text: "Sample text", // content shown in the <p>
          attrs: { class: "text-item" }, // added as attributes to the element
        };
      }
      if (type === "Button") {
        return {
          text: "Click me", // button label
          attrs: { class: "btn", type: "button" }, // class + native button type
        };
      }
      // Fallback
      return { text: "New item", attrs: {} };
    },
  },
};
</script>

<style>
/* Style for the component library (drag source) */
.library {
  margin-bottom: 10px;
  display: flex;
  gap: 8px;
}

/* Visual preview area where items are dropped */
.preview {
  min-height: 100px;
  border: 1px dashed black;
  padding: 10px;
}

/* Basic styles for inserted button components */
.btn {
  padding: 5px 10px;
  background-color: #4caf50; /* green background */
  color: white;
  border: none;
  cursor: pointer;
}

/* Basic style for inserted text components */
.text-item {
  margin: 6px 0;
  font-size: 14px;
}
</style>
