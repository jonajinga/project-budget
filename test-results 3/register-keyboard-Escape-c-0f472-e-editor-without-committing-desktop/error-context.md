# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: register-keyboard.spec.js >> Escape closes the editor without committing
- Location: tests/e2e/register-keyboard.spec.js:89:1

# Error details

```
Error: Escape must not commit

expect(received).toBe(expected) // Object.is equality

Expected: "Payment received"
Received: ""
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - button "Open app navigation" [ref=e5] [cursor=pointer]
      - link "Sample household" [ref=e7] [cursor=pointer]:
        - /url: /app/
      - generic [ref=e9]:
        - button "Search the site" [ref=e10] [cursor=pointer]
        - button "Choose a theme" [ref=e15] [cursor=pointer]
  - main [ref=e18]:
    - generic [ref=e21]:
      - generic [ref=e22]:
        - heading "All accounts" [level=1] [ref=e24]
        - button "Register actions" [ref=e26] [cursor=pointer]
      - generic [ref=e31]:
        - heading "Recurring transactions due" [level=2] [ref=e32]
        - paragraph [ref=e33]: Review each one before it posts. You can skip an occurrence to push the next date forward without recording it.
        - table [ref=e34]:
          - rowgroup [ref=e35]:
            - row [ref=e36]:
              - columnheader "Date" [ref=e37]
              - columnheader "Account" [ref=e38]
              - columnheader "Payee" [ref=e39]
              - columnheader "Amount" [ref=e40]
              - columnheader "Actions" [ref=e41]
          - rowgroup [ref=e42]:
            - row [ref=e43]:
              - cell "2026-05-22" [ref=e44]
              - cell "Joint Checking" [ref=e45]
              - cell "Marcus Employer" [ref=e46]
              - cell "$5,400.00" [ref=e47]
              - cell [ref=e48]:
                - generic [ref=e49]:
                  - button "Post" [ref=e50] [cursor=pointer]
                  - button "Skip" [ref=e51] [cursor=pointer]
            - row [ref=e52]:
              - cell "2026-05-22" [ref=e53]
              - cell "Lena's Checking" [ref=e54]
              - cell "Lena Employer" [ref=e55]
              - cell "$3,950.00" [ref=e56]
              - cell [ref=e57]:
                - generic [ref=e58]:
                  - button "Post" [ref=e59] [cursor=pointer]
                  - button "Skip" [ref=e60] [cursor=pointer]
            - row [ref=e61]:
              - cell "2026-06-01" [ref=e62]
              - cell "Joint Checking" [ref=e63]
              - cell "Chase Mortgage Co" [ref=e64]
              - cell "-$2,680.00" [ref=e65]
              - cell [ref=e66]:
                - generic [ref=e67]:
                  - button "Post" [ref=e68] [cursor=pointer]
                  - button "Skip" [ref=e69] [cursor=pointer]
            - row [ref=e70]:
              - cell "2026-06-02" [ref=e71]
              - cell "Joint Checking" [ref=e72]
              - cell "HOA" [ref=e73]
              - cell "-$180.00" [ref=e74]
              - cell [ref=e75]:
                - generic [ref=e76]:
                  - button "Post" [ref=e77] [cursor=pointer]
                  - button "Skip" [ref=e78] [cursor=pointer]
            - row [ref=e79]:
              - cell "2026-06-12" [ref=e80]
              - cell "Joint Checking" [ref=e81]
              - cell "Verizon" [ref=e82]
              - cell "-$89.99" [ref=e83]
              - cell [ref=e84]:
                - generic [ref=e85]:
                  - button "Post" [ref=e86] [cursor=pointer]
                  - button "Skip" [ref=e87] [cursor=pointer]
            - row [ref=e88]:
              - cell "2026-06-03" [ref=e89]
              - cell "Visa Signature" [ref=e90]
              - cell "Netflix" [ref=e91]
              - cell "-$22.99" [ref=e92]
              - cell [ref=e93]:
                - generic [ref=e94]:
                  - button "Post" [ref=e95] [cursor=pointer]
                  - button "Skip" [ref=e96] [cursor=pointer]
            - row [ref=e97]:
              - cell "2026-06-05" [ref=e98]
              - cell "Visa Signature" [ref=e99]
              - cell "Spotify Family" [ref=e100]
              - cell "-$16.99" [ref=e101]
              - cell [ref=e102]:
                - generic [ref=e103]:
                  - button "Post" [ref=e104] [cursor=pointer]
                  - button "Skip" [ref=e105] [cursor=pointer]
            - row [ref=e106]:
              - cell "2026-06-08" [ref=e107]
              - cell "Joint Checking" [ref=e108]
              - cell "ConEdison" [ref=e109]
              - cell "-$175.00" [ref=e110]
              - cell [ref=e111]:
                - generic [ref=e112]:
                  - button "Post" [ref=e113] [cursor=pointer]
                  - button "Skip" [ref=e114] [cursor=pointer]
            - row [ref=e115]:
              - cell "2026-06-05" [ref=e116]
              - cell "Joint Checking" [ref=e117]
              - cell "Geico" [ref=e118]
              - cell "-$218.00" [ref=e119]
              - cell [ref=e120]:
                - generic [ref=e121]:
                  - button "Post" [ref=e122] [cursor=pointer]
                  - button "Skip" [ref=e123] [cursor=pointer]
            - row [ref=e124]:
              - cell "2026-06-07" [ref=e125]
              - cell "Joint Checking" [ref=e126]
              - cell "First Christian Church" [ref=e127]
              - cell "-$500.00" [ref=e128]
              - cell [ref=e129]:
                - generic [ref=e130]:
                  - button "Post" [ref=e131] [cursor=pointer]
                  - button "Skip" [ref=e132] [cursor=pointer]
            - row [ref=e133]:
              - cell "2026-06-15" [ref=e134]
              - cell "Joint Checking" [ref=e135]
              - cell "T-Mobile" [ref=e136]
              - cell "-$165.00" [ref=e137]
              - cell [ref=e138]:
                - generic [ref=e139]:
                  - button "Post" [ref=e140] [cursor=pointer]
                  - button "Skip" [ref=e141] [cursor=pointer]
      - generic [ref=e142]:
        - generic [ref=e143]:
          - generic [ref=e144]:
            - generic [ref=e145]:
              - textbox "Filter by account" [ref=e146]:
                - /placeholder: All accounts
              - button "Toggle account filter" [ref=e147] [cursor=pointer]
            - searchbox "Search payee or memo" [ref=e150]
          - paragraph [ref=e152]: 1399 shown
        - table [ref=e153]:
          - rowgroup [ref=e154]:
            - row [ref=e155]:
              - columnheader [ref=e156]:
                - checkbox "Select all visible transactions" [ref=e157] [cursor=pointer]
              - columnheader "Date" [ref=e158]
              - columnheader "Account" [ref=e159]
              - columnheader "Payee" [ref=e160]
              - columnheader "Category" [ref=e161]
              - columnheader "Memo" [ref=e162]
              - columnheader "Amount" [ref=e163]
              - columnheader "Cleared" [ref=e164]: C
              - columnheader "Actions" [ref=e165]
          - rowgroup [ref=e166]:
            - row [ref=e167]:
              - cell [ref=e168]:
                - checkbox "Select transaction" [ref=e169] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-28" [ref=e170]':
                - generic [ref=e171]:
                  - strong [ref=e172]: May 28
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-28" [ref=e173]': Chase Sapphire
              - 'cell "Payee: transaction on 2026-05-28" [ref=e174]': —
              - 'cell "Category: transaction on 2026-05-28" [ref=e175]':
                - generic [ref=e176]: —
              - 'cell "Memo: transaction on 2026-05-28" [ref=e177]':
                - textbox [active] [ref=e178]: Payment received
              - 'cell "Amount: transaction on 2026-05-28" [ref=e179]': $777.36
              - cell [ref=e180]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e181] [cursor=pointer]:
                  - generic [ref=e182]: ✓
              - cell [ref=e183]:
                - button "Transaction actions" [ref=e186] [cursor=pointer]
            - row [ref=e191]:
              - cell [ref=e192]:
                - checkbox "Select transaction" [ref=e193] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-27" [ref=e194]':
                - generic [ref=e195]:
                  - strong [ref=e196]: May 27
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-27" [ref=e197]': Joint Checking
              - 'cell "Payee: transaction on 2026-05-27" [ref=e198]': —
              - 'cell "Category: transaction on 2026-05-27" [ref=e199]':
                - generic [ref=e200]: —
              - 'cell "Memo: transaction on 2026-05-27" [ref=e201]': Sapphire payment
              - 'cell "Amount: transaction on 2026-05-27" [ref=e202]': "-$470.72"
              - cell [ref=e203]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e204] [cursor=pointer]:
                  - generic [ref=e205]: ✓
              - cell [ref=e206]:
                - button "Transaction actions" [ref=e209] [cursor=pointer]
            - row [ref=e214]:
              - cell [ref=e215]:
                - checkbox "Select Starbucks" [ref=e216] [cursor=pointer]
              - 'cell "Date: Starbucks on 2026-05-26" [ref=e217]':
                - generic [ref=e218]:
                  - strong [ref=e219]: May 26
                  - text: "2026"
              - 'cell "Account: Starbucks on 2026-05-26" [ref=e220]': Chase Sapphire
              - 'cell "Payee: Starbucks on 2026-05-26" [ref=e221]': Starbucks
              - 'cell "Category: Starbucks on 2026-05-26" [ref=e222]':
                - generic [ref=e223]: Coffee
              - 'cell "Memo: Starbucks on 2026-05-26" [ref=e224]'
              - 'cell "Amount: Starbucks on 2026-05-26" [ref=e225]': "-$6.62"
              - cell [ref=e226]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e227] [cursor=pointer]:
                  - generic [ref=e228]: ✓
              - cell [ref=e229]:
                - button "Transaction actions" [ref=e232] [cursor=pointer]
            - row [ref=e237]:
              - cell [ref=e238]:
                - checkbox "Select Olive Garden" [ref=e239] [cursor=pointer]
              - 'cell "Date: Olive Garden on 2026-05-26" [ref=e240]':
                - generic [ref=e241]:
                  - strong [ref=e242]: May 26
                  - text: "2026"
              - 'cell "Account: Olive Garden on 2026-05-26" [ref=e243]': Chase Sapphire
              - 'cell "Payee: Olive Garden on 2026-05-26" [ref=e244]': Olive Garden
              - 'cell "Category: Olive Garden on 2026-05-26" [ref=e245]':
                - generic [ref=e246]: Dining out
              - 'cell "Memo: Olive Garden on 2026-05-26" [ref=e247]'
              - 'cell "Amount: Olive Garden on 2026-05-26" [ref=e248]': "-$71.15"
              - cell [ref=e249]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e250] [cursor=pointer]:
                  - generic [ref=e251]: ✓
              - cell [ref=e252]:
                - button "Transaction actions" [ref=e255] [cursor=pointer]
            - row [ref=e260]:
              - cell [ref=e261]:
                - checkbox "Select transaction" [ref=e262] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-26" [ref=e263]':
                - generic [ref=e264]:
                  - strong [ref=e265]: May 26
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-26" [ref=e266]': Visa Signature
              - 'cell "Payee: transaction on 2026-05-26" [ref=e267]': —
              - 'cell "Category: transaction on 2026-05-26" [ref=e268]':
                - generic [ref=e269]: —
              - 'cell "Memo: transaction on 2026-05-26" [ref=e270]': Payment received
              - 'cell "Amount: transaction on 2026-05-26" [ref=e271]': $1,231.00
              - cell [ref=e272]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e273] [cursor=pointer]:
                  - generic [ref=e274]: ✓
              - cell [ref=e275]:
                - button "Transaction actions" [ref=e278] [cursor=pointer]
            - row [ref=e283]:
              - cell [ref=e284]:
                - checkbox "Select United Way" [ref=e285] [cursor=pointer]
              - 'cell "Date: United Way on 2026-05-25" [ref=e286]':
                - generic [ref=e287]:
                  - strong [ref=e288]: May 25
                  - text: "2026"
              - 'cell "Account: United Way on 2026-05-25" [ref=e289]': Joint Checking
              - 'cell "Payee: United Way on 2026-05-25" [ref=e290]': United Way
              - 'cell "Category: United Way on 2026-05-25" [ref=e291]':
                - generic [ref=e292]: Local
              - 'cell "Memo: United Way on 2026-05-25" [ref=e293]': Local giving
              - 'cell "Amount: United Way on 2026-05-25" [ref=e294]': "-$40.00"
              - cell [ref=e295]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e296] [cursor=pointer]:
                  - generic [ref=e297]: ✓
              - cell [ref=e298]:
                - button "Transaction actions" [ref=e301] [cursor=pointer]
            - row [ref=e306]:
              - cell [ref=e307]:
                - checkbox "Select Local Coffee" [ref=e308] [cursor=pointer]
              - 'cell "Date: Local Coffee on 2026-05-25" [ref=e309]':
                - generic [ref=e310]:
                  - strong [ref=e311]: May 25
                  - text: "2026"
              - 'cell "Account: Local Coffee on 2026-05-25" [ref=e312]': Chase Sapphire
              - 'cell "Payee: Local Coffee on 2026-05-25" [ref=e313]': Local Coffee
              - 'cell "Category: Local Coffee on 2026-05-25" [ref=e314]':
                - generic [ref=e315]: Coffee
              - 'cell "Memo: Local Coffee on 2026-05-25" [ref=e316]'
              - 'cell "Amount: Local Coffee on 2026-05-25" [ref=e317]': "-$8.85"
              - cell [ref=e318]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e319] [cursor=pointer]:
                  - generic [ref=e320]: ✓
              - cell [ref=e321]:
                - button "Transaction actions" [ref=e324] [cursor=pointer]
            - row [ref=e329]:
              - cell [ref=e330]:
                - checkbox "Select transaction" [ref=e331] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-25" [ref=e332]':
                - generic [ref=e333]:
                  - strong [ref=e334]: May 25
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-25" [ref=e335]': Joint Checking
              - 'cell "Payee: transaction on 2026-05-25" [ref=e336]': —
              - 'cell "Category: transaction on 2026-05-25" [ref=e337]':
                - generic [ref=e338]: Copays
              - 'cell "Memo: transaction on 2026-05-25" [ref=e339]': Office visit
              - 'cell "Amount: transaction on 2026-05-25" [ref=e340]': "-$30.78"
              - cell [ref=e341]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e342] [cursor=pointer]:
                  - generic [ref=e343]: ✓
              - cell [ref=e344]:
                - button "Transaction actions" [ref=e347] [cursor=pointer]
            - row [ref=e352]:
              - cell [ref=e353]:
                - checkbox "Select transaction" [ref=e354] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-25" [ref=e355]':
                - generic [ref=e356]:
                  - strong [ref=e357]: May 25
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-25" [ref=e358]': Joint Checking
              - 'cell "Payee: transaction on 2026-05-25" [ref=e359]': —
              - 'cell "Category: transaction on 2026-05-25" [ref=e360]':
                - generic [ref=e361]: —
              - 'cell "Memo: transaction on 2026-05-25" [ref=e362]': Visa payment
              - 'cell "Amount: transaction on 2026-05-25" [ref=e363]': "-$1,284.78"
              - cell [ref=e364]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e365] [cursor=pointer]:
                  - generic [ref=e366]: ✓
              - cell [ref=e367]:
                - button "Transaction actions" [ref=e370] [cursor=pointer]
            - row [ref=e375]:
              - cell [ref=e376]:
                - checkbox "Select Costco" [ref=e377] [cursor=pointer]
              - 'cell "Date: Costco on 2026-05-24" [ref=e378]':
                - generic [ref=e379]:
                  - strong [ref=e380]: May 24
                  - text: "2026"
              - 'cell "Account: Costco on 2026-05-24" [ref=e381]': Visa Signature
              - 'cell "Payee: Costco on 2026-05-24" [ref=e382]': Costco
              - 'cell "Category: Costco on 2026-05-24" [ref=e383]':
                - generic [ref=e384]: Groceries
              - 'cell "Memo: Costco on 2026-05-24" [ref=e385]'
              - 'cell "Amount: Costco on 2026-05-24" [ref=e386]': "-$101.13"
              - cell [ref=e387]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e388] [cursor=pointer]:
                  - generic [ref=e389]: ✓
              - cell [ref=e390]:
                - button "Transaction actions" [ref=e393] [cursor=pointer]
            - row [ref=e398]:
              - cell [ref=e399]:
                - checkbox "Select Costco" [ref=e400] [cursor=pointer]
              - 'cell "Date: Costco on 2026-05-24" [ref=e401]':
                - generic [ref=e402]:
                  - strong [ref=e403]: May 24
                  - text: "2026"
              - 'cell "Account: Costco on 2026-05-24" [ref=e404]': Visa Signature
              - 'cell "Payee: Costco on 2026-05-24" [ref=e405]': Costco
              - 'cell "Category: Costco on 2026-05-24" [ref=e406]':
                - generic [ref=e407]: Groceries
              - 'cell "Memo: Costco on 2026-05-24" [ref=e408]'
              - 'cell "Amount: Costco on 2026-05-24" [ref=e409]': "-$131.96"
              - cell [ref=e410]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e411] [cursor=pointer]:
                  - generic [ref=e412]: ✓
              - cell [ref=e413]:
                - button "Transaction actions" [ref=e416] [cursor=pointer]
            - row [ref=e421]:
              - cell [ref=e422]:
                - checkbox "Select Amazon" [ref=e423] [cursor=pointer]
              - 'cell "Date: Amazon on 2026-05-24" [ref=e424]':
                - generic [ref=e425]:
                  - strong [ref=e426]: May 24
                  - text: "2026"
              - 'cell "Account: Amazon on 2026-05-24" [ref=e427]': Visa Signature
              - 'cell "Payee: Amazon on 2026-05-24" [ref=e428]': Amazon
              - 'cell "Category: Amazon on 2026-05-24" [ref=e429]':
                - generic [ref=e430]: Maintenance
              - 'cell "Memo: Amazon on 2026-05-24" [ref=e431]'
              - 'cell "Amount: Amazon on 2026-05-24" [ref=e432]': "-$61.04"
              - cell [ref=e433]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e434] [cursor=pointer]:
                  - generic [ref=e435]: ✓
              - cell [ref=e436]:
                - button "Transaction actions" [ref=e439] [cursor=pointer]
            - row [ref=e444]:
              - cell [ref=e445]:
                - checkbox "Select NYTimes" [ref=e446] [cursor=pointer]
              - 'cell "Date: NYTimes on 2026-05-23" [ref=e447]':
                - generic [ref=e448]:
                  - strong [ref=e449]: May 23
                  - text: "2026"
              - 'cell "Account: NYTimes on 2026-05-23" [ref=e450]': Visa Signature
              - 'cell "Payee: NYTimes on 2026-05-23" [ref=e451]': NYTimes
              - 'cell "Category: NYTimes on 2026-05-23" [ref=e452]':
                - generic [ref=e453]: News
              - 'cell "Memo: NYTimes on 2026-05-23" [ref=e454]': Subscription
              - 'cell "Amount: NYTimes on 2026-05-23" [ref=e455]': "-$17.00"
              - cell [ref=e456]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e457] [cursor=pointer]:
                  - generic [ref=e458]: ✓
              - cell [ref=e459]:
                - button "Transaction actions" [ref=e462] [cursor=pointer]
            - row [ref=e467]:
              - cell [ref=e468]:
                - checkbox "Select Local Coffee" [ref=e469] [cursor=pointer]
              - 'cell "Date: Local Coffee on 2026-05-23" [ref=e470]':
                - generic [ref=e471]:
                  - strong [ref=e472]: May 23
                  - text: "2026"
              - 'cell "Account: Local Coffee on 2026-05-23" [ref=e473]': Chase Sapphire
              - 'cell "Payee: Local Coffee on 2026-05-23" [ref=e474]': Local Coffee
              - 'cell "Category: Local Coffee on 2026-05-23" [ref=e475]':
                - generic [ref=e476]: Coffee
              - 'cell "Memo: Local Coffee on 2026-05-23" [ref=e477]'
              - 'cell "Amount: Local Coffee on 2026-05-23" [ref=e478]': "-$10.46"
              - cell [ref=e479]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e480] [cursor=pointer]:
                  - generic [ref=e481]: ✓
              - cell [ref=e482]:
                - button "Transaction actions" [ref=e485] [cursor=pointer]
            - row [ref=e490]:
              - cell [ref=e491]:
                - checkbox "Select transaction" [ref=e492] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-22" [ref=e493]':
                - generic [ref=e494]:
                  - strong [ref=e495]: May 22
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-22" [ref=e496]': HSA
              - 'cell "Payee: transaction on 2026-05-22" [ref=e497]': —
              - 'cell "Category: transaction on 2026-05-22" [ref=e498]':
                - generic [ref=e499]: —
              - 'cell "Memo: transaction on 2026-05-22" [ref=e500]': Contribution + growth
              - 'cell "Amount: transaction on 2026-05-22" [ref=e501]': $212.96
              - cell [ref=e502]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e503] [cursor=pointer]:
                  - generic [ref=e504]: ✓
              - cell [ref=e505]:
                - button "Transaction actions" [ref=e508] [cursor=pointer]
            - row [ref=e513]:
              - cell [ref=e514]:
                - checkbox "Select transaction" [ref=e515] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-21" [ref=e516]':
                - generic [ref=e517]:
                  - strong [ref=e518]: May 21
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-21" [ref=e519]': Joint Checking
              - 'cell "Payee: transaction on 2026-05-21" [ref=e520]': —
              - 'cell "Category: transaction on 2026-05-21" [ref=e521]':
                - generic [ref=e522]: Premiums
              - 'cell "Memo: transaction on 2026-05-21" [ref=e523]': Family premium share
              - 'cell "Amount: transaction on 2026-05-21" [ref=e524]': "-$425.00"
              - cell [ref=e525]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e526] [cursor=pointer]:
                  - generic [ref=e527]: ✓
              - cell [ref=e528]:
                - button "Transaction actions" [ref=e531] [cursor=pointer]
            - row [ref=e536]:
              - cell [ref=e537]:
                - checkbox "Select transaction" [ref=e538] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-21" [ref=e539]':
                - generic [ref=e540]:
                  - strong [ref=e541]: May 21
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-21" [ref=e542]': Brokerage
              - 'cell "Payee: transaction on 2026-05-21" [ref=e543]': —
              - 'cell "Category: transaction on 2026-05-21" [ref=e544]':
                - generic [ref=e545]: —
              - 'cell "Memo: transaction on 2026-05-21" [ref=e546]': Market activity
              - 'cell "Amount: transaction on 2026-05-21" [ref=e547]': $1,827.41
              - cell [ref=e548]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e549] [cursor=pointer]:
                  - generic [ref=e550]: ✓
              - cell [ref=e551]:
                - button "Transaction actions" [ref=e554] [cursor=pointer]
            - row [ref=e559]:
              - cell [ref=e560]:
                - checkbox "Select transaction" [ref=e561] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-19" [ref=e562]':
                - generic [ref=e563]:
                  - strong [ref=e564]: May 19
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-19" [ref=e565]': Marcus Roth IRA
              - 'cell "Payee: transaction on 2026-05-19" [ref=e566]': —
              - 'cell "Category: transaction on 2026-05-19" [ref=e567]':
                - generic [ref=e568]: —
              - 'cell "Memo: transaction on 2026-05-19" [ref=e569]': Contribution + growth
              - 'cell "Amount: transaction on 2026-05-19" [ref=e570]': $476.50
              - cell [ref=e571]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e572] [cursor=pointer]:
                  - generic [ref=e573]: ✓
              - cell [ref=e574]:
                - button "Transaction actions" [ref=e577] [cursor=pointer]
            - row [ref=e582]:
              - cell [ref=e583]:
                - checkbox "Select transaction" [ref=e584] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-19" [ref=e585]':
                - generic [ref=e586]:
                  - strong [ref=e587]: May 19
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-19" [ref=e588]': Lena Roth IRA
              - 'cell "Payee: transaction on 2026-05-19" [ref=e589]': —
              - 'cell "Category: transaction on 2026-05-19" [ref=e590]':
                - generic [ref=e591]: —
              - 'cell "Memo: transaction on 2026-05-19" [ref=e592]': Contribution + growth
              - 'cell "Amount: transaction on 2026-05-19" [ref=e593]': $334.76
              - cell [ref=e594]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e595] [cursor=pointer]:
                  - generic [ref=e596]: ✓
              - cell [ref=e597]:
                - button "Transaction actions" [ref=e600] [cursor=pointer]
            - row [ref=e605]:
              - cell [ref=e606]:
                - checkbox "Select State Farm" [ref=e607] [cursor=pointer]
              - 'cell "Date: State Farm on 2026-05-18" [ref=e608]':
                - generic [ref=e609]:
                  - strong [ref=e610]: May 18
                  - text: "2026"
              - 'cell "Account: State Farm on 2026-05-18" [ref=e611]': Joint Checking
              - 'cell "Payee: State Farm on 2026-05-18" [ref=e612]': State Farm
              - 'cell "Category: State Farm on 2026-05-18" [ref=e613]':
                - generic [ref=e614]: Life
              - 'cell "Memo: State Farm on 2026-05-18" [ref=e615]': Term life premium
              - 'cell "Amount: State Farm on 2026-05-18" [ref=e616]': "-$78.00"
              - cell [ref=e617]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e618] [cursor=pointer]:
                  - generic [ref=e619]: ✓
              - cell [ref=e620]:
                - button "Transaction actions" [ref=e623] [cursor=pointer]
            - row [ref=e628]:
              - cell [ref=e629]:
                - checkbox "Select State Farm" [ref=e630] [cursor=pointer]
              - 'cell "Date: State Farm on 2026-05-18" [ref=e631]':
                - generic [ref=e632]:
                  - strong [ref=e633]: May 18
                  - text: "2026"
              - 'cell "Account: State Farm on 2026-05-18" [ref=e634]': Joint Checking
              - 'cell "Payee: State Farm on 2026-05-18" [ref=e635]': State Farm
              - 'cell "Category: State Farm on 2026-05-18" [ref=e636]':
                - generic [ref=e637]: Umbrella
              - 'cell "Memo: State Farm on 2026-05-18" [ref=e638]': Umbrella policy
              - 'cell "Amount: State Farm on 2026-05-18" [ref=e639]': "-$42.00"
              - cell [ref=e640]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e641] [cursor=pointer]:
                  - generic [ref=e642]: ✓
              - cell [ref=e643]:
                - button "Transaction actions" [ref=e646] [cursor=pointer]
            - row [ref=e651]:
              - cell [ref=e652]:
                - checkbox "Select Lena Employer" [ref=e653] [cursor=pointer]
              - 'cell "Date: Lena Employer on 2026-05-15" [ref=e654]':
                - generic [ref=e655]:
                  - strong [ref=e656]: May 15
                  - text: "2026"
              - 'cell "Account: Lena Employer on 2026-05-15" [ref=e657]': Lena's Checking
              - 'cell "Payee: Lena Employer on 2026-05-15" [ref=e658]': Lena Employer
              - 'cell "Category: Lena Employer on 2026-05-15" [ref=e659]':
                - generic [ref=e660]: Lena paycheck
              - 'cell "Memo: Lena Employer on 2026-05-15" [ref=e661]': Direct deposit
              - 'cell "Amount: Lena Employer on 2026-05-15" [ref=e662]': $3,950.00
              - cell [ref=e663]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e664] [cursor=pointer]:
                  - generic [ref=e665]: ✓
              - cell [ref=e666]:
                - button "Transaction actions" [ref=e669] [cursor=pointer]
            - row [ref=e674]:
              - cell [ref=e675]:
                - checkbox "Select T-Mobile" [ref=e676] [cursor=pointer]
              - 'cell "Date: T-Mobile on 2026-05-15" [ref=e677]':
                - generic [ref=e678]:
                  - strong [ref=e679]: May 15
                  - text: "2026"
              - 'cell "Account: T-Mobile on 2026-05-15" [ref=e680]': Joint Checking
              - 'cell "Payee: T-Mobile on 2026-05-15" [ref=e681]': T-Mobile
              - 'cell "Category: T-Mobile on 2026-05-15" [ref=e682]':
                - generic [ref=e683]: Utilities
              - 'cell "Memo: T-Mobile on 2026-05-15" [ref=e684]': Family cell plan
              - 'cell "Amount: T-Mobile on 2026-05-15" [ref=e685]': "-$165.00"
              - cell [ref=e686]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e687] [cursor=pointer]:
                  - generic [ref=e688]: ✓
              - cell [ref=e689]:
                - button "Transaction actions" [ref=e692] [cursor=pointer]
            - row [ref=e697]:
              - cell [ref=e698]:
                - checkbox "Select Apple iCloud" [ref=e699] [cursor=pointer]
              - 'cell "Date: Apple iCloud on 2026-05-15" [ref=e700]':
                - generic [ref=e701]:
                  - strong [ref=e702]: May 15
                  - text: "2026"
              - 'cell "Account: Apple iCloud on 2026-05-15" [ref=e703]': Visa Signature
              - 'cell "Payee: Apple iCloud on 2026-05-15" [ref=e704]': Apple iCloud
              - 'cell "Category: Apple iCloud on 2026-05-15" [ref=e705]':
                - generic [ref=e706]: Cloud storage
              - 'cell "Memo: Apple iCloud on 2026-05-15" [ref=e707]': iCloud 2TB
              - 'cell "Amount: Apple iCloud on 2026-05-15" [ref=e708]': "-$9.99"
              - cell [ref=e709]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e710] [cursor=pointer]:
                  - generic [ref=e711]: ✓
              - cell [ref=e712]:
                - button "Transaction actions" [ref=e715] [cursor=pointer]
            - row [ref=e720]:
              - cell [ref=e721]:
                - checkbox "Select Walgreens" [ref=e722] [cursor=pointer]
              - 'cell "Date: Walgreens on 2026-05-15" [ref=e723]':
                - generic [ref=e724]:
                  - strong [ref=e725]: May 15
                  - text: "2026"
              - 'cell "Account: Walgreens on 2026-05-15" [ref=e726]': Visa Signature
              - 'cell "Payee: Walgreens on 2026-05-15" [ref=e727]': Walgreens
              - 'cell "Category: Walgreens on 2026-05-15" [ref=e728]':
                - generic [ref=e729]: Pharmacy
              - 'cell "Memo: Walgreens on 2026-05-15" [ref=e730]': Rx refill
              - 'cell "Amount: Walgreens on 2026-05-15" [ref=e731]': "-$39.15"
              - cell [ref=e732]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e733] [cursor=pointer]:
                  - generic [ref=e734]: ✓
              - cell [ref=e735]:
                - button "Transaction actions" [ref=e738] [cursor=pointer]
            - row [ref=e743]:
              - cell [ref=e744]:
                - checkbox "Select transaction" [ref=e745] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-15" [ref=e746]':
                - generic [ref=e747]:
                  - strong [ref=e748]: May 15
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-15" [ref=e749]': Marcus 401(k)
              - 'cell "Payee: transaction on 2026-05-15" [ref=e750]': —
              - 'cell "Category: transaction on 2026-05-15" [ref=e751]':
                - generic [ref=e752]: —
              - 'cell "Memo: transaction on 2026-05-15" [ref=e753]': Contribution + growth
              - 'cell "Amount: transaction on 2026-05-15" [ref=e754]': $2,704.15
              - cell [ref=e755]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e756] [cursor=pointer]:
                  - generic [ref=e757]: ✓
              - cell [ref=e758]:
                - button "Transaction actions" [ref=e761] [cursor=pointer]
            - row [ref=e766]:
              - cell [ref=e767]:
                - checkbox "Select transaction" [ref=e768] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-15" [ref=e769]':
                - generic [ref=e770]:
                  - strong [ref=e771]: May 15
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-15" [ref=e772]': Lena 403(b)
              - 'cell "Payee: transaction on 2026-05-15" [ref=e773]': —
              - 'cell "Category: transaction on 2026-05-15" [ref=e774]':
                - generic [ref=e775]: —
              - 'cell "Memo: transaction on 2026-05-15" [ref=e776]': Contribution + growth
              - 'cell "Amount: transaction on 2026-05-15" [ref=e777]': $1,121.42
              - cell [ref=e778]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e779] [cursor=pointer]:
                  - generic [ref=e780]: ✓
              - cell [ref=e781]:
                - button "Transaction actions" [ref=e784] [cursor=pointer]
            - row [ref=e789]:
              - cell [ref=e790]:
                - checkbox "Select transaction" [ref=e791] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-15" [ref=e792]':
                - generic [ref=e793]:
                  - strong [ref=e794]: May 15
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-15" [ref=e795]': Joint Checking
              - 'cell "Payee: transaction on 2026-05-15" [ref=e796]': —
              - 'cell "Category: transaction on 2026-05-15" [ref=e797]':
                - generic [ref=e798]: Hair
              - 'cell "Memo: transaction on 2026-05-15" [ref=e799]': Haircut
              - 'cell "Amount: transaction on 2026-05-15" [ref=e800]': "-$65.59"
              - cell [ref=e801]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e802] [cursor=pointer]:
                  - generic [ref=e803]: ✓
              - cell [ref=e804]:
                - button "Transaction actions" [ref=e807] [cursor=pointer]
            - row [ref=e812]:
              - cell [ref=e813]:
                - checkbox "Select Verizon" [ref=e814] [cursor=pointer]
              - 'cell "Date: Verizon on 2026-05-12" [ref=e815]':
                - generic [ref=e816]:
                  - strong [ref=e817]: May 12
                  - text: "2026"
              - 'cell "Account: Verizon on 2026-05-12" [ref=e818]': Joint Checking
              - 'cell "Payee: Verizon on 2026-05-12" [ref=e819]': Verizon
              - 'cell "Category: Verizon on 2026-05-12" [ref=e820]':
                - generic [ref=e821]: Utilities
              - 'cell "Memo: Verizon on 2026-05-12" [ref=e822]': Fios internet
              - 'cell "Amount: Verizon on 2026-05-12" [ref=e823]': "-$89.99"
              - cell [ref=e824]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e825] [cursor=pointer]:
                  - generic [ref=e826]: ✓
              - cell [ref=e827]:
                - button "Transaction actions" [ref=e830] [cursor=pointer]
            - row [ref=e835]:
              - cell [ref=e836]:
                - checkbox "Select Trader Joe's" [ref=e837] [cursor=pointer]
              - 'cell "Date: Trader Joe''s on 2026-05-12" [ref=e838]':
                - generic [ref=e839]:
                  - strong [ref=e840]: May 12
                  - text: "2026"
              - 'cell "Account: Trader Joe''s on 2026-05-12" [ref=e841]': Visa Signature
              - 'cell "Payee: Trader Joe''s on 2026-05-12" [ref=e842]': Trader Joe's
              - 'cell "Category: Trader Joe''s on 2026-05-12" [ref=e843]':
                - generic [ref=e844]: Groceries
              - 'cell "Memo: Trader Joe''s on 2026-05-12" [ref=e845]'
              - 'cell "Amount: Trader Joe''s on 2026-05-12" [ref=e846]': "-$179.89"
              - cell [ref=e847]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e848] [cursor=pointer]:
                  - generic [ref=e849]: ✓
              - cell [ref=e850]:
                - button "Transaction actions" [ref=e853] [cursor=pointer]
            - row [ref=e858]:
              - cell [ref=e859]:
                - checkbox "Select Boys & Girls Club" [ref=e860] [cursor=pointer]
              - 'cell "Date: Boys & Girls Club on 2026-05-12" [ref=e861]':
                - generic [ref=e862]:
                  - strong [ref=e863]: May 12
                  - text: "2026"
              - 'cell "Account: Boys & Girls Club on 2026-05-12" [ref=e864]': Joint Checking
              - 'cell "Payee: Boys & Girls Club on 2026-05-12" [ref=e865]': Boys & Girls Club
              - 'cell "Category: Boys & Girls Club on 2026-05-12" [ref=e866]':
                - generic [ref=e867]: Activities
              - 'cell "Memo: Boys & Girls Club on 2026-05-12" [ref=e868]': After-school program
              - 'cell "Amount: Boys & Girls Club on 2026-05-12" [ref=e869]': "-$225.00"
              - cell [ref=e870]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e871] [cursor=pointer]:
                  - generic [ref=e872]: ✓
              - cell [ref=e873]:
                - button "Transaction actions" [ref=e876] [cursor=pointer]
            - row [ref=e881]:
              - cell [ref=e882]:
                - checkbox "Select Chevron" [ref=e883] [cursor=pointer]
              - 'cell "Date: Chevron on 2026-05-11" [ref=e884]':
                - generic [ref=e885]:
                  - strong [ref=e886]: May 11
                  - text: "2026"
              - 'cell "Account: Chevron on 2026-05-11" [ref=e887]': Chase Sapphire
              - 'cell "Payee: Chevron on 2026-05-11" [ref=e888]': Chevron
              - 'cell "Category: Chevron on 2026-05-11" [ref=e889]':
                - generic [ref=e890]: Gas
              - 'cell "Memo: Chevron on 2026-05-11" [ref=e891]'
              - 'cell "Amount: Chevron on 2026-05-11" [ref=e892]': "-$55.11"
              - cell [ref=e893]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e894] [cursor=pointer]:
                  - generic [ref=e895]: ✓
              - cell [ref=e896]:
                - button "Transaction actions" [ref=e899] [cursor=pointer]
            - row [ref=e904]:
              - cell [ref=e905]:
                - checkbox "Select Whole Foods" [ref=e906] [cursor=pointer]
              - 'cell "Date: Whole Foods on 2026-05-11" [ref=e907]':
                - generic [ref=e908]:
                  - strong [ref=e909]: May 11
                  - text: "2026"
              - 'cell "Account: Whole Foods on 2026-05-11" [ref=e910]': Visa Signature
              - 'cell "Payee: Whole Foods on 2026-05-11" [ref=e911]': Whole Foods
              - 'cell "Category: Whole Foods on 2026-05-11" [ref=e912]':
                - generic [ref=e913]: Groceries
              - 'cell "Memo: Whole Foods on 2026-05-11" [ref=e914]'
              - 'cell "Amount: Whole Foods on 2026-05-11" [ref=e915]': "-$161.90"
              - cell [ref=e916]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e917] [cursor=pointer]:
                  - generic [ref=e918]: ✓
              - cell [ref=e919]:
                - button "Transaction actions" [ref=e922] [cursor=pointer]
            - row [ref=e927]:
              - cell [ref=e928]:
                - checkbox "Select transaction" [ref=e929] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-11" [ref=e930]':
                - generic [ref=e931]:
                  - strong [ref=e932]: May 11
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-11" [ref=e933]': Ari 529
              - 'cell "Payee: transaction on 2026-05-11" [ref=e934]': —
              - 'cell "Category: transaction on 2026-05-11" [ref=e935]':
                - generic [ref=e936]: —
              - 'cell "Memo: transaction on 2026-05-11" [ref=e937]': Contribution + growth
              - 'cell "Amount: transaction on 2026-05-11" [ref=e938]': $254.10
              - cell [ref=e939]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e940] [cursor=pointer]:
                  - generic [ref=e941]: ✓
              - cell [ref=e942]:
                - button "Transaction actions" [ref=e945] [cursor=pointer]
            - row [ref=e950]:
              - cell [ref=e951]:
                - checkbox "Select transaction" [ref=e952] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-11" [ref=e953]':
                - generic [ref=e954]:
                  - strong [ref=e955]: May 11
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-11" [ref=e956]': Beatrice 529
              - 'cell "Payee: transaction on 2026-05-11" [ref=e957]': —
              - 'cell "Category: transaction on 2026-05-11" [ref=e958]':
                - generic [ref=e959]: —
              - 'cell "Memo: transaction on 2026-05-11" [ref=e960]': Contribution + growth
              - 'cell "Amount: transaction on 2026-05-11" [ref=e961]': $398.42
              - cell [ref=e962]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e963] [cursor=pointer]:
                  - generic [ref=e964]: ✓
              - cell [ref=e965]:
                - button "Transaction actions" [ref=e968] [cursor=pointer]
            - row [ref=e973]:
              - cell [ref=e974]:
                - checkbox "Select transaction" [ref=e975] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-11" [ref=e976]':
                - generic [ref=e977]:
                  - strong [ref=e978]: May 11
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-11" [ref=e979]': Connor 529
              - 'cell "Payee: transaction on 2026-05-11" [ref=e980]': —
              - 'cell "Category: transaction on 2026-05-11" [ref=e981]':
                - generic [ref=e982]: —
              - 'cell "Memo: transaction on 2026-05-11" [ref=e983]': Contribution + growth
              - 'cell "Amount: transaction on 2026-05-11" [ref=e984]': $349.55
              - cell [ref=e985]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e986] [cursor=pointer]:
                  - generic [ref=e987]: ✓
              - cell [ref=e988]:
                - button "Transaction actions" [ref=e991] [cursor=pointer]
            - row [ref=e996]:
              - cell [ref=e997]:
                - checkbox "Select transaction" [ref=e998] [cursor=pointer]
              - 'cell "Date: transaction on 2026-05-11" [ref=e999]':
                - generic [ref=e1000]:
                  - strong [ref=e1001]: May 11
                  - text: "2026"
              - 'cell "Account: transaction on 2026-05-11" [ref=e1002]': Daria 529
              - 'cell "Payee: transaction on 2026-05-11" [ref=e1003]': —
              - 'cell "Category: transaction on 2026-05-11" [ref=e1004]':
                - generic [ref=e1005]: —
              - 'cell "Memo: transaction on 2026-05-11" [ref=e1006]': Contribution + growth
              - 'cell "Amount: transaction on 2026-05-11" [ref=e1007]': $203.22
              - cell [ref=e1008]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1009] [cursor=pointer]:
                  - generic [ref=e1010]: ✓
              - cell [ref=e1011]:
                - button "Transaction actions" [ref=e1014] [cursor=pointer]
            - row [ref=e1019]:
              - cell [ref=e1020]:
                - checkbox "Select Disney+" [ref=e1021] [cursor=pointer]
              - 'cell "Date: Disney+ on 2026-05-10" [ref=e1022]':
                - generic [ref=e1023]:
                  - strong [ref=e1024]: May 10
                  - text: "2026"
              - 'cell "Account: Disney+ on 2026-05-10" [ref=e1025]': Visa Signature
              - 'cell "Payee: Disney+ on 2026-05-10" [ref=e1026]': Disney+
              - 'cell "Category: Disney+ on 2026-05-10" [ref=e1027]':
                - generic [ref=e1028]: Streaming
              - 'cell "Memo: Disney+ on 2026-05-10" [ref=e1029]': Bundle
              - 'cell "Amount: Disney+ on 2026-05-10" [ref=e1030]': "-$15.99"
              - cell [ref=e1031]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1032] [cursor=pointer]:
                  - generic [ref=e1033]: ✓
              - cell [ref=e1034]:
                - button "Transaction actions" [ref=e1037] [cursor=pointer]
            - row [ref=e1042]:
              - cell [ref=e1043]:
                - checkbox "Select Ari piano teacher" [ref=e1044] [cursor=pointer]
              - 'cell "Date: Ari piano teacher on 2026-05-10" [ref=e1045]':
                - generic [ref=e1046]:
                  - strong [ref=e1047]: May 10
                  - text: "2026"
              - 'cell "Account: Ari piano teacher on 2026-05-10" [ref=e1048]': Joint Checking
              - 'cell "Payee: Ari piano teacher on 2026-05-10" [ref=e1049]': Ari piano teacher
              - 'cell "Category: Ari piano teacher on 2026-05-10" [ref=e1050]':
                - generic [ref=e1051]: Activities
              - 'cell "Memo: Ari piano teacher on 2026-05-10" [ref=e1052]': Piano lessons
              - 'cell "Amount: Ari piano teacher on 2026-05-10" [ref=e1053]': "-$210.13"
              - cell [ref=e1054]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1055] [cursor=pointer]:
                  - generic [ref=e1056]: ✓
              - cell [ref=e1057]:
                - button "Transaction actions" [ref=e1060] [cursor=pointer]
            - row [ref=e1065]:
              - cell [ref=e1066]:
                - checkbox "Select Whole Foods" [ref=e1067] [cursor=pointer]
              - 'cell "Date: Whole Foods on 2026-05-10" [ref=e1068]':
                - generic [ref=e1069]:
                  - strong [ref=e1070]: May 10
                  - text: "2026"
              - 'cell "Account: Whole Foods on 2026-05-10" [ref=e1071]': Visa Signature
              - 'cell "Payee: Whole Foods on 2026-05-10" [ref=e1072]': Whole Foods
              - 'cell "Category: Whole Foods on 2026-05-10" [ref=e1073]':
                - generic [ref=e1074]: Groceries
              - 'cell "Memo: Whole Foods on 2026-05-10" [ref=e1075]'
              - 'cell "Amount: Whole Foods on 2026-05-10" [ref=e1076]': "-$173.69"
              - cell [ref=e1077]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1078] [cursor=pointer]:
                  - generic [ref=e1079]: ✓
              - cell [ref=e1080]:
                - button "Transaction actions" [ref=e1083] [cursor=pointer]
            - row [ref=e1088]:
              - cell [ref=e1089]:
                - checkbox "Select Marcus Employer" [ref=e1090] [cursor=pointer]
              - 'cell "Date: Marcus Employer on 2026-05-08" [ref=e1091]':
                - generic [ref=e1092]:
                  - strong [ref=e1093]: May 8
                  - text: "2026"
              - 'cell "Account: Marcus Employer on 2026-05-08" [ref=e1094]': Joint Checking
              - 'cell "Payee: Marcus Employer on 2026-05-08" [ref=e1095]': Marcus Employer
              - 'cell "Category: Marcus Employer on 2026-05-08" [ref=e1096]':
                - generic [ref=e1097]: Marcus paycheck
              - 'cell "Memo: Marcus Employer on 2026-05-08" [ref=e1098]': Direct deposit
              - 'cell "Amount: Marcus Employer on 2026-05-08" [ref=e1099]': $5,400.00
              - cell [ref=e1100]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1101] [cursor=pointer]:
                  - generic [ref=e1102]: ✓
              - cell [ref=e1103]:
                - button "Transaction actions" [ref=e1106] [cursor=pointer]
            - row [ref=e1111]:
              - cell [ref=e1112]:
                - checkbox "Select ConEdison" [ref=e1113] [cursor=pointer]
              - 'cell "Date: ConEdison on 2026-05-08" [ref=e1114]':
                - generic [ref=e1115]:
                  - strong [ref=e1116]: May 8
                  - text: "2026"
              - 'cell "Account: ConEdison on 2026-05-08" [ref=e1117]': Joint Checking
              - 'cell "Payee: ConEdison on 2026-05-08" [ref=e1118]': ConEdison
              - 'cell "Category: ConEdison on 2026-05-08" [ref=e1119]':
                - generic [ref=e1120]: Utilities
              - 'cell "Memo: ConEdison on 2026-05-08" [ref=e1121]': Electric
              - 'cell "Amount: ConEdison on 2026-05-08" [ref=e1122]': "-$233.74"
              - cell [ref=e1123]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1124] [cursor=pointer]:
                  - generic [ref=e1125]: ✓
              - cell [ref=e1126]:
                - button "Transaction actions" [ref=e1129] [cursor=pointer]
            - row [ref=e1134]:
              - cell [ref=e1135]:
                - checkbox "Select First Christian Church" [ref=e1136] [cursor=pointer]
              - 'cell "Date: First Christian Church on 2026-05-07" [ref=e1137]':
                - generic [ref=e1138]:
                  - strong [ref=e1139]: May 7
                  - text: "2026"
              - 'cell "Account: First Christian Church on 2026-05-07" [ref=e1140]': Joint Checking
              - 'cell "Payee: First Christian Church on 2026-05-07" [ref=e1141]': First Christian Church
              - 'cell "Category: First Christian Church on 2026-05-07" [ref=e1142]':
                - generic [ref=e1143]: Tithe
              - 'cell "Memo: First Christian Church on 2026-05-07" [ref=e1144]': Monthly tithe
              - 'cell "Amount: First Christian Church on 2026-05-07" [ref=e1145]': "-$500.00"
              - cell [ref=e1146]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1147] [cursor=pointer]:
                  - generic [ref=e1148]: ✓
              - cell [ref=e1149]:
                - button "Transaction actions" [ref=e1152] [cursor=pointer]
            - row [ref=e1157]:
              - cell [ref=e1158]:
                - checkbox "Select Starbucks" [ref=e1159] [cursor=pointer]
              - 'cell "Date: Starbucks on 2026-05-07" [ref=e1160]':
                - generic [ref=e1161]:
                  - strong [ref=e1162]: May 7
                  - text: "2026"
              - 'cell "Account: Starbucks on 2026-05-07" [ref=e1163]': Chase Sapphire
              - 'cell "Payee: Starbucks on 2026-05-07" [ref=e1164]': Starbucks
              - 'cell "Category: Starbucks on 2026-05-07" [ref=e1165]':
                - generic [ref=e1166]: Coffee
              - 'cell "Memo: Starbucks on 2026-05-07" [ref=e1167]'
              - 'cell "Amount: Starbucks on 2026-05-07" [ref=e1168]': "-$9.30"
              - cell [ref=e1169]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1170] [cursor=pointer]:
                  - generic [ref=e1171]: ✓
              - cell [ref=e1172]:
                - button "Transaction actions" [ref=e1175] [cursor=pointer]
            - row [ref=e1180]:
              - cell [ref=e1181]:
                - checkbox "Select Chipotle" [ref=e1182] [cursor=pointer]
              - 'cell "Date: Chipotle on 2026-05-07" [ref=e1183]':
                - generic [ref=e1184]:
                  - strong [ref=e1185]: May 7
                  - text: "2026"
              - 'cell "Account: Chipotle on 2026-05-07" [ref=e1186]': Chase Sapphire
              - 'cell "Payee: Chipotle on 2026-05-07" [ref=e1187]': Chipotle
              - 'cell "Category: Chipotle on 2026-05-07" [ref=e1188]':
                - generic [ref=e1189]: Dining out
              - 'cell "Memo: Chipotle on 2026-05-07" [ref=e1190]'
              - 'cell "Amount: Chipotle on 2026-05-07" [ref=e1191]': "-$31.18"
              - cell [ref=e1192]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1193] [cursor=pointer]:
                  - generic [ref=e1194]: ✓
              - cell [ref=e1195]:
                - button "Transaction actions" [ref=e1198] [cursor=pointer]
            - row [ref=e1203]:
              - cell [ref=e1204]:
                - checkbox "Select Spotify Family" [ref=e1205] [cursor=pointer]
              - 'cell "Date: Spotify Family on 2026-05-06" [ref=e1206]':
                - generic [ref=e1207]:
                  - strong [ref=e1208]: May 6
                  - text: "2026"
              - 'cell "Account: Spotify Family on 2026-05-06" [ref=e1209]': Visa Signature
              - 'cell "Payee: Spotify Family on 2026-05-06" [ref=e1210]': Spotify Family
              - 'cell "Category: Spotify Family on 2026-05-06" [ref=e1211]':
                - generic [ref=e1212]: Streaming
              - 'cell "Memo: Spotify Family on 2026-05-06" [ref=e1213]': Family plan
              - 'cell "Amount: Spotify Family on 2026-05-06" [ref=e1214]': "-$16.99"
              - cell [ref=e1215]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1216] [cursor=pointer]:
                  - generic [ref=e1217]: ✓
              - cell [ref=e1218]:
                - button "Transaction actions" [ref=e1221] [cursor=pointer]
            - row [ref=e1226]:
              - cell [ref=e1227]:
                - checkbox "Select Geico" [ref=e1228] [cursor=pointer]
              - 'cell "Date: Geico on 2026-05-05" [ref=e1229]':
                - generic [ref=e1230]:
                  - strong [ref=e1231]: May 5
                  - text: "2026"
              - 'cell "Account: Geico on 2026-05-05" [ref=e1232]': Joint Checking
              - 'cell "Payee: Geico on 2026-05-05" [ref=e1233]': Geico
              - 'cell "Category: Geico on 2026-05-05" [ref=e1234]':
                - generic [ref=e1235]: Insurance
              - 'cell "Memo: Geico on 2026-05-05" [ref=e1236]': Auto insurance
              - 'cell "Amount: Geico on 2026-05-05" [ref=e1237]': "-$218.00"
              - cell [ref=e1238]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1239] [cursor=pointer]:
                  - generic [ref=e1240]: ✓
              - cell [ref=e1241]:
                - button "Transaction actions" [ref=e1244] [cursor=pointer]
            - row [ref=e1249]:
              - cell [ref=e1250]:
                - checkbox "Select Amazon" [ref=e1251] [cursor=pointer]
              - 'cell "Date: Amazon on 2026-05-05" [ref=e1252]':
                - generic [ref=e1253]:
                  - strong [ref=e1254]: May 5
                  - text: "2026"
              - 'cell "Account: Amazon on 2026-05-05" [ref=e1255]': Visa Signature
              - 'cell "Payee: Amazon on 2026-05-05" [ref=e1256]': Amazon
              - 'cell "Category: Amazon on 2026-05-05" [ref=e1257]':
                - generic [ref=e1258]: Hobbies
              - 'cell "Memo: Amazon on 2026-05-05" [ref=e1259]'
              - 'cell "Amount: Amazon on 2026-05-05" [ref=e1260]': "-$88.72"
              - cell [ref=e1261]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1262] [cursor=pointer]:
                  - generic [ref=e1263]: ✓
              - cell [ref=e1264]:
                - button "Transaction actions" [ref=e1267] [cursor=pointer]
            - row [ref=e1272]:
              - cell [ref=e1273]:
                - checkbox "Select Target" [ref=e1274] [cursor=pointer]
              - 'cell "Date: Target on 2026-05-04" [ref=e1275]':
                - generic [ref=e1276]:
                  - strong [ref=e1277]: May 4
                  - text: "2026"
              - 'cell "Account: Target on 2026-05-04" [ref=e1278]': Visa Signature
              - 'cell "Payee: Target on 2026-05-04" [ref=e1279]': Target
              - 'cell "Category: Target on 2026-05-04" [ref=e1280]':
                - generic [ref=e1281]: Groceries
              - 'cell "Memo: Target on 2026-05-04" [ref=e1282]'
              - 'cell "Amount: Target on 2026-05-04" [ref=e1283]': "-$124.67"
              - cell [ref=e1284]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1285] [cursor=pointer]:
                  - generic [ref=e1286]: ✓
              - cell [ref=e1287]:
                - button "Transaction actions" [ref=e1290] [cursor=pointer]
            - row [ref=e1295]:
              - cell [ref=e1296]:
                - checkbox "Select Netflix" [ref=e1297] [cursor=pointer]
              - 'cell "Date: Netflix on 2026-05-03" [ref=e1298]':
                - generic [ref=e1299]:
                  - strong [ref=e1300]: May 3
                  - text: "2026"
              - 'cell "Account: Netflix on 2026-05-03" [ref=e1301]': Visa Signature
              - 'cell "Payee: Netflix on 2026-05-03" [ref=e1302]': Netflix
              - 'cell "Category: Netflix on 2026-05-03" [ref=e1303]':
                - generic [ref=e1304]: Streaming
              - 'cell "Memo: Netflix on 2026-05-03" [ref=e1305]': Premium plan
              - 'cell "Amount: Netflix on 2026-05-03" [ref=e1306]': "-$22.99"
              - cell [ref=e1307]:
                - button "Cleared. Click to uncheck." [pressed] [ref=e1308] [cursor=pointer]:
                  - generic [ref=e1309]: ✓
              - cell [ref=e1310]:
                - button "Transaction actions" [ref=e1313] [cursor=pointer]
            - row [ref=e1318]:
              - cell [ref=e1319]:
                - button "Load 50 more (1349 remaining)" [ref=e1320] [cursor=pointer]:
                  - generic [ref=e1321]: Load 50 more
                  - generic [ref=e1322]: (1349 remaining)
    - button "Quick-add transaction" [ref=e1323] [cursor=pointer]
  - contentinfo [ref=e1325]:
    - generic [ref=e1326]:
      - generic [ref=e1327]:
        - paragraph [ref=e1328]: Project Budget
        - paragraph [ref=e1329]: Envelope budgeting that lives in your browser.
      - navigation "Footer" [ref=e1330]:
        - list [ref=e1331]:
          - listitem [ref=e1332]:
            - link "Docs" [ref=e1333] [cursor=pointer]:
              - /url: /docs/
          - listitem [ref=e1334]:
            - link "Blog" [ref=e1335] [cursor=pointer]:
              - /url: /blog/
          - listitem [ref=e1336]:
            - link "Glossary" [ref=e1337] [cursor=pointer]:
              - /url: /glossary/
          - listitem [ref=e1338]:
            - link "Open source" [ref=e1339] [cursor=pointer]:
              - /url: /open-source/
          - listitem [ref=e1340]:
            - link "About" [ref=e1341] [cursor=pointer]:
              - /url: /about/
          - listitem [ref=e1342]:
            - link "Accessibility" [ref=e1343] [cursor=pointer]:
              - /url: /accessibility/
          - listitem [ref=e1344]:
            - link "Style guide" [ref=e1345] [cursor=pointer]:
              - /url: /style-guide/
          - listitem [ref=e1346]:
            - link "Contact" [ref=e1347] [cursor=pointer]:
              - /url: /contact/
          - listitem [ref=e1348]:
            - link "Sitemap" [ref=e1349] [cursor=pointer]:
              - /url: /sitemap/
          - listitem [ref=e1350]:
            - link "Privacy" [ref=e1351] [cursor=pointer]:
              - /url: /privacy/
          - listitem [ref=e1352]:
            - link "Terms" [ref=e1353] [cursor=pointer]:
              - /url: /terms/
          - listitem [ref=e1354]:
            - link "GitHub" [ref=e1355] [cursor=pointer]:
              - /url: https://github.com/jonajinga/project-budget
      - generic [ref=e1356]:
        - text: ·
        - paragraph [ref=e1357]: © 2026 Project Budget. MIT licensed.
        - paragraph [ref=e1358]:
          - text: Website by
          - link "Pikes Peak Web Designs" [ref=e1359] [cursor=pointer]:
            - /url: https://pikespeakwebdesigns.com
          - text: .
```

# Test source

```ts
  8   | 
  9   | const desktopOnly = (viewport) => !viewport || viewport.width < 900;
  10  | 
  11  | test("exactly one cell is tabbable at a time", async ({ seeded, viewport }) => {
  12  |   test.skip(desktopOnly(viewport), "the table only renders on desktop");
  13  |   const page = await seeded.newPage();
  14  |   await gotoApp(page, "/app/register/");
  15  |   await page.waitForTimeout(600);
  16  |   const counts = await page.evaluate(() => {
  17  |     const cells = [...document.querySelectorAll(".register__table td.cell--edit")];
  18  |     return {
  19  |       total: cells.length,
  20  |       tabbable: cells.filter((c) => c.getAttribute("tabindex") === "0").length,
  21  |     };
  22  |   });
  23  |   expect(counts.total, "cells should render").toBeGreaterThan(10);
  24  |   expect(counts.tabbable, "roving tabindex means exactly one entry point").toBe(1);
  25  |   await page.close();
  26  | });
  27  | 
  28  | test("arrow keys move across and down the grid", async ({ seeded, viewport }) => {
  29  |   test.skip(desktopOnly(viewport), "the table only renders on desktop");
  30  |   const page = await seeded.newPage();
  31  |   await gotoApp(page, "/app/register/");
  32  |   await page.waitForTimeout(600);
  33  | 
  34  |   await page.evaluate(() => document.querySelector('td.cell--edit[tabindex="0"]').focus());
  35  |   const start = await page.evaluate(() => document.activeElement.dataset.cell);
  36  |   expect(start).toMatch(/:date$/);
  37  | 
  38  |   await page.keyboard.press("ArrowRight");
  39  |   expect(await page.evaluate(() => document.activeElement.dataset.cell)).toMatch(/:accountId$/);
  40  | 
  41  |   await page.keyboard.press("End");
  42  |   expect(await page.evaluate(() => document.activeElement.dataset.cell)).toMatch(/:amount$/);
  43  | 
  44  |   await page.keyboard.press("Home");
  45  |   expect(await page.evaluate(() => document.activeElement.dataset.cell)).toMatch(/:date$/);
  46  | 
  47  |   const rowBefore = start.split(":")[0];
  48  |   await page.keyboard.press("ArrowDown");
  49  |   const after = await page.evaluate(() => document.activeElement.dataset.cell);
  50  |   expect(after.split(":")[0], "ArrowDown should change row").not.toBe(rowBefore);
  51  |   expect(after).toMatch(/:date$/);
  52  |   await page.close();
  53  | });
  54  | 
  55  | test("Enter opens the editor and Enter commits, returning focus to the cell", async ({ seeded, viewport }) => {
  56  |   test.skip(desktopOnly(viewport), "the table only renders on desktop");
  57  |   const page = await seeded.newPage();
  58  |   await gotoApp(page, "/app/register/");
  59  |   await page.waitForTimeout(600);
  60  | 
  61  |   /* Walk to a memo cell: free text, so committing cannot fail validation. */
  62  |   await page.evaluate(() => document.querySelector('td.cell--edit[tabindex="0"]').focus());
  63  |   for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  64  |   const cell = await page.evaluate(() => document.activeElement.dataset.cell);
  65  |   expect(cell).toMatch(/:memo$/);
  66  | 
  67  |   await page.keyboard.press("Enter");
  68  |   /* The editor input does not exist until Alpine renders it, so focusing it
  69  |      legitimately waits a tick -- unlike cell-to-cell movement, which is
  70  |      synchronous because every cell is already in the DOM. */
  71  |   await page.waitForFunction(
  72  |     () => document.activeElement && document.activeElement.matches("input, select"),
  73  |     { timeout: 3000 }
  74  |   );
  75  | 
  76  |   await page.keyboard.type("keyboard test");
  77  |   await page.keyboard.press("Enter");
  78  |   await page.waitForTimeout(300);
  79  | 
  80  |   const landed = await page.evaluate(() => ({
  81  |     cell: document.activeElement.dataset ? document.activeElement.dataset.cell : null,
  82  |     tag: document.activeElement.tagName,
  83  |   }));
  84  |   expect(landed.tag, "focus must not fall to body").not.toBe("BODY");
  85  |   expect(landed.cell, "focus returns to the cell it came from").toBe(cell);
  86  |   await page.close();
  87  | });
  88  | 
  89  | test("Escape closes the editor without committing", async ({ seeded, viewport }) => {
  90  |   test.skip(desktopOnly(viewport), "the table only renders on desktop");
  91  |   const page = await seeded.newPage();
  92  |   await gotoApp(page, "/app/register/");
  93  |   await page.waitForTimeout(600);
  94  | 
  95  |   await page.evaluate(() => document.querySelector('td.cell--edit[tabindex="0"]').focus());
  96  |   for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  97  |   const cell = await page.evaluate(() => document.activeElement.dataset.cell);
  98  |   const before = await page.evaluate((c) =>
  99  |     document.querySelector(`[data-cell="${c}"]`).innerText.trim(), cell);
  100 | 
  101 |   await page.keyboard.press("Enter");
  102 |   await page.keyboard.type("discard me");
  103 |   await page.keyboard.press("Escape");
  104 |   await page.waitForTimeout(300);
  105 | 
  106 |   const after = await page.evaluate((c) =>
  107 |     document.querySelector(`[data-cell="${c}"]`).innerText.trim(), cell);
> 108 |   expect(after, "Escape must not commit").toBe(before);
      |                                           ^ Error: Escape must not commit
  109 |   expect(await page.evaluate(() => document.activeElement.dataset.cell)).toBe(cell);
  110 |   await page.close();
  111 | });
  112 | 
```