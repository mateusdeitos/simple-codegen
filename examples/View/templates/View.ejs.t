---
to: examples/generated/Views/<%=viewName%>View.php
force: true
---
<?php

class <%=viewName%>View <%=interfaces ? `implements ${interfaces}` : null%> {
<% if (interface_methods) { %>
<%-interface_methods%>
<% } %>
}
