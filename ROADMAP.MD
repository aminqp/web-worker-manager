
# Roadmap MVP

**Phase 1:**

* [x] Implement the main Worker features
    * [x] Allow main worker to import an external function
    * [x] Enable the main worker to open a thread
    * [x] Enable the main worker to terminate a thread
    * [x] Enable the main worker to catch and concat the result of run worker(s)
    * [ ] Threads error handling
    * [ ] Retries number for a faulty thread
    * [ ] handle a faulty passed function
    * [ ] how to pass data to a thread
    * [ ] type od data that can be passed to a thread Array, Object, number, etc
    * [ ] partition data for threads
* [ ] Eslint plugin for core function
  * [ ] the plugin must throw an error if a user function is not runnable by a web worker

**Phase 2**
* [ ] Bug fixing and maintenance.
* [ ] Performance optimization.
* [ ] Community support and issue resolution.