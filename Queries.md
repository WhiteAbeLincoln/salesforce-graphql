# Query Types
## Root-Parent-Parent
### Query
```graphql
Contact {
  Account {
    Parent {
      Id
    }
  }
}
```
### Expected
```sql
  SELECT Account.Parent.Id FROM Contact
```
### Actual
*Works*

## Root-Parent-Child
### Query
```graphql
Contact {
  Account {
    Contacts {
      Id
    }
  }
}
```
### Expected
```sql
SELECT (SELECT Id FROM Account.Contacts) FROM Contact
```
### Actual
*Does Not Work*
#### Solution
```sql
  SELECT Account.Id FROM Contact
```
For every `Account.Id` do
```sql
  SELECT (SELECT Id FROM Contacts) FROM Account WHERE Id = '${Account.Id}' 
```
## Root-Child-Child
### Query
```graphql
Account {
  Contacts {
    Events {
      Id
    }
  }
}
```
### Expected
```sql
SELECT (SELECT (SELECT Id FROM Events) FROM Contacts) FROM Account
```
### Actual
*Does Not Work*
#### Solution
```sql
SELECT (SELECT Id FROM Contacts) FROM Account
```
for every `Id` as `CId` do
```sql
SELECT Id, (SELECT Id FROM Events) FROM Contact WHERE Contact.Id = '${CId}'
```
## Root-Child-Parent
### Query
```graphql
Account {
  Contacts {
    Account {
      Id
    }
  }
}
```
### Expected
  ```sql
    SELECT (SELECT Account.Id FROM Contacts) FROM Account
  ```
### Actual
  *Works*  
  Can reduce to:
  ```sql
    SELECT Id FROM Account -- repeat for number of contacts under account
  ```