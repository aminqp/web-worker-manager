function wait({ seconds, index }: { seconds: number, index: number }) {
  console.log(`\n\n<<<<<  wait >>>>> => seconds -> `, seconds);
  seconds *= Math.random() + 0.5;
  let start = new Date();
  while (((new Date()).valueOf() - start.valueOf()) / 1000 < seconds);

  return `${index} = seconds: ${seconds}`;
};

export default wait;
