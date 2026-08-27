import { Redirect } from "expo-router";

// Never actually navigated to - the tab bar's center button is fully
// replaced by CreateTabButton in _layout.tsx (custom tabBarButton +
// tabPress preventDefault), which pushes /tasks/new directly instead.
// This file exists only so expo-router has a route to attach the tab to.
export default function CreateTabPlaceholder() {
  return <Redirect href="/" />;
}
