# DCRData Front End Testing

### Preparation

- Pages should be tested in the following desktop browsers. You will primarily use your favorite browser, but some compatibility testing should always be performed.
  - Chrome
  - Firefox
  - Brave
  - Internet Explorer
- Disable resource caching in dev tools.
- Run the monitoring script, `npm run watch`, in a terminal. Recheck the output every time you save a change to a javascript file.
- Open the web development tools in your browser (F12 on most browsers). When not actively using the dev tools, leave the console open so that you will see any JS errors.

### Tips

- Click everything
- Navigating to (most) new pages should not cause an actual page reload, courtesy of the Turbolinks package. Either watch the network tab when navigating between pages, or just make sure the console is not being cleared.
- Look for things you can't see, but should.
- If you come across issues not related to your PR, make sure to talk to the other devs or open an issue.

### Checklist

- ##### Every page
  - Manually adjust the width of your browser window and watch how the layout adjusts. Pay particular attention around the bootstrap cutoffs at 576, 768, 992, and 1200 px.
  - Check night mode.
  - Is the alignment pleasant for every item in every table? Both vertically and horizontally?
  - Check Turbolinks by navigating to and from the page using both page links and your browsers' forward and backwards navigation arrow buttons.
  - Is the font size legible? Is the font family appropriate for the type of information being displayed?
  - Do top-level page elements have pleasant margins and padding?
  - Refresh the page, and make sure that everything works as it should.
  - Do table elements make use of table space efficiently? Adjust the size and see when table text wraps and creates double-high rows.

- ##### Every chart
  - Different chart types.
  - Chart time groupings
  - Zoom buttons
  - Zoom sliders
  - Hover effect - chart callout.
  - Axes labels
  - Appropriate units
  - Margins and padding

- ##### Top Navigation Menu
  - Clicking the logo should bring you to the homepage.
  - Clicking hamburger icon should toggle the hamburger menu.
  - Color and tooltip hover effects on hamburger menu items.
  - Correct destination for each item of the hamburger menu.
  - Test at least one block number, one address, and one transaction id in the search bar.

- ##### Footer
  - Elements should be aligned symmetrically.
  - Block timer should be ticking every 10 seconds.
  - Block timer should reset when a new block is connected.
  - Is the year right?

- ##### Address (/address/{address})
  - For an address with a lot of transactions, check the project fund. There's a link on the homepage.
  - List size selector
  - List page navigation
  - Chart view. (see "Every chart" above)
  - Transaction type selection
  - Age column updates
  - QR code

- ##### Blocks (/blocks)
  - Page size select
  - Page navigation buttons
  - When look at recent blocks, does the age column update as expected?

- ##### Charts (/charts)
  - See "Every chart" above.
  - Moving average selector

- ##### Home page (/)
  - Is the alignment pleasant for every item in every table in both the vertical and horizontal directions?
  - See how it looks at 769px. Are the elements overlapping?

- ##### Mempool (/mempool)
  - The lists should update live.
  - Is there messaging to indicate empty lists? Does that messaging disappear when items are added?

- ##### Ticket pool (/ticketpool)
  - See "Every chart" above

- ##### Transaction (/tx/{txid})
  - Raw view (decoded and hex) buttons. Note that these are a couple of the only links on the site that will take you out of the Turbolinks flow.
  - Live updates. Watch a ticket as blocks are connected through the following transitions.
    1. mempool -> immature
    2. immature -> mature
  - Watch a vote transaction live as it matures
  - Confirmation counter live update

### API

There is a comprehensive list of API endpoints in the [README](https://github.com/decred/dcrdata/blob/master/README.md). If you make changes to types used by the API, you should check the appropriate endpoints.
