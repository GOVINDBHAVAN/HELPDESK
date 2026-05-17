FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["Helpdesk.Api.csproj", "./"]
RUN dotnet restore "Helpdesk.Api.csproj"

COPY . .
RUN dotnet publish "Helpdesk.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 5000
ENTRYPOINT ["dotnet", "Helpdesk.Api.dll"]
