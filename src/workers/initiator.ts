export default () => {
  self.addEventListener('message', (event) => {
    self.postMessage(event.data);
  });
};
